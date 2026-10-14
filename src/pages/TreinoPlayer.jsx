import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'

import PageLoadingBoundary from '../components/ui/PageLoadingBoundary'

import WorkoutHeader from '../components/WorkoutHeader'
import CurrentExerciseCard from '../components/CurrentExerciseCard'
import WorkoutProgress from '../components/WorkoutProgress'
import WorkoutTimer from '../components/WorkoutTimer'
import WorkoutQuickControls from '../components/WorkoutQuickControls.js'
import WorkoutActions from '../components/WorkoutActions'
import WorkoutInfo from '../components/WorkoutInfo'
import PreWorkoutModal from '../components/PreWorkoutModal'
import WorkoutSessionRecoveryModal from '../components/WorkoutSessionRecoveryModal'
import SessionFeedback from '../components/SessionFeedback'

import { useAuth } from '../hooks/useAuth'

import { buscarTreinoCompleto } from '../services/treinos/treinosService'

import { useTreinoAtivo } from '../hooks/useTreinoAtivo'
import { useQuickWorkoutControls } from '../hooks/useQuickWorkoutControls.js'
import { isPushEntry } from '../services/push/quickWorkoutControls.js'
import { ordemSecaoParaApresentacao } from '../hooks/treinoSessaoControllerUtils'
import { logError } from '../utils/errorMessages'

export default function TreinoPlayer() {

  const navigate = useNavigate()

  const { id } = useParams()

  const { usuario } = useAuth()

  const [treino, setTreino] = useState(null)
  const [loading, setLoading] = useState(true)

  const location = useLocation()
  const descansoPadrao = location.state?.descansoPadrao ?? 60
  const [modalInicialOpen, setModalInicialOpen] = useState(
    location.state?.descansoPadrao == null
  )

  useEffect(() => {
    if (!usuario?.id) return undefined

    let active = true
    setLoading(true)
    setTreino(null)
    setModalInicialOpen(location.state?.descansoPadrao == null)

    async function carregarTreino() {

      try {

        const data = await buscarTreinoCompleto(id)

        if (active) setTreino(data)

      } catch (error) {

        if (active) logError(error, '[TreinoPlayer] Failed to load workout')

      } finally {

        if (active) setLoading(false)
      }
    }

    carregarTreino()

    return () => {
      active = false
    }

  }, [id, location.state?.descansoPadrao, usuario?.id])

  const treinoAtivo = useTreinoAtivo({
    treino,
    idUsuario: usuario?.id,
    descansoPadrao,

    onFinalizar: () => {
      navigate('/treinar')
    },

    onCancelar: () => {
      navigate('/treinar')
    },

  })

  const fromPush = isPushEntry(location.search)
  const quickControls = useQuickWorkoutControls({
    fromPush, userId: usuario?.id, workoutId: id, scopeKey: location.key,
    player: treinoAtivo,
  })
  const salvando = treinoAtivo.salvando || quickControls.busy
  const feedbackControle = quickControls.feedback
    ? [treinoAtivo.erro || treinoAtivo.aviso, quickControls.feedback].filter(Boolean).join(' ')
    : treinoAtivo.erro

  if (loading || !usuario?.id) {
    return <PageLoadingBoundary loading loadingMessage="Carregando treino..." />
  }

  if (!treino) {

    return (
      <div className="flex min-h-screen items-center justify-center bg-app-muted">

        <div className="max-w-md rounded-2xl border border-app-line bg-app-surface p-8 text-center">

          <h2 className="mb-2 text-xl font-semibold text-app-ink">
            Treino não encontrado
          </h2>

          <p className="mb-5 text-app-secondary">
            O treino solicitado não existe ou foi removido.
          </p>

          <button
            onClick={() => navigate('/treinar')}
            className="rounded-xl bg-app-action px-5 py-3 text-white hover:bg-app-action-hover"
          >
            Voltar
          </button>

        </div>

      </div>
    )
  }

  if (treinoAtivo.carregandoSessao) {
    return <PageLoadingBoundary loading loadingMessage="Recuperando sessão..." />
  }

  const exerciseContext = (
    <div key="exercise-context" className="space-y-5 lg:col-span-2 lg:col-start-1 lg:row-start-1">
      <WorkoutProgress
        percentual={treinoAtivo.estado.percentual}
        exerciciosFeitos={treinoAtivo.estado.exerciciosFeitos}
        totalExercicios={treinoAtivo.estado.totalExercicios}
        serieAtual={treinoAtivo.serieAtual}
        totalSeries={treinoAtivo.exercicioAtual?.series ?? 0}
      />

      <CurrentExerciseCard
        key={`${treinoAtivo.exercicioAtual?.id_treino_exercicio ?? 'sem-exercicio'}:${treinoAtivo.serieAtual}`}
        exercicio={treinoAtivo.exercicioAtual}
        serieAtual={treinoAtivo.serieAtual}
        valoresIniciais={treinoAtivo.valoresIniciaisExercicio}
        status={treinoAtivo.status}
        tempoDescanso={treinoAtivo.tempoDescanso}
        onConcluirSerie={treinoAtivo.concluirSerie}
        processando={salvando}
        pausado={treinoAtivo.pausado}
      />
    </div>
  )
  const sessionControls = (
    <aside key="session-controls" className="space-y-4 lg:col-start-3 lg:row-start-1 lg:sticky lg:top-5">

      <WorkoutTimer
        formatted={
          treinoAtivo.status === 'descansando'
            ? treinoAtivo.descansoTimer.formatted
            : treinoAtivo.workoutTimer.formatted
        }
        isRunning={treinoAtivo.workoutTimer.isRunning}
        status={treinoAtivo.status}
        pausado={treinoAtivo.pausado}
        percentualDescanso={treinoAtivo.descansoTimer.percentual}
        proximaSerie={
          treinoAtivo.exercicioAtual
            ? `${treinoAtivo.exercicioAtual.nome} · série ${treinoAtivo.serieAtual} de ${treinoAtivo.exercicioAtual.series}`
            : null
        }
        onToggle={treinoAtivo.workoutTimer.toggle}
        onAdicionarTempo={treinoAtivo.descansoTimer.adicionarTempo}
        onPularDescanso={treinoAtivo.pularDescanso}
        disabled={salvando}
        restControls={fromPush ? (quickControls.state ? (
          <WorkoutQuickControls state={quickControls.state} busy={salvando} onAction={quickControls.execute} />
        ) : false) : undefined}
      />

      <WorkoutActions
        status={treinoAtivo.status}
        finalizado={treinoAtivo.finalizado}
        salvando={salvando}
        pausado={treinoAtivo.pausado}

        onIniciar={() => treinoAtivo.iniciarTreino(descansoPadrao)}

        onAvancar={treinoAtivo.avancarExercicio}
        onFinalizar={treinoAtivo.finalizarTreino}
      />

      <WorkoutInfo
        nomeSecao={treinoAtivo.exercicioAtual?.secao}
        descricaoSecao={treinoAtivo.exercicioAtual?.descricaoSecao}
        ordemSecao={ordemSecaoParaApresentacao(treinoAtivo.exercicioAtual)}
        exerciciosRestantes={treinoAtivo.estado.exerciciosRestantes}
        seriesRestantes={treinoAtivo.estado.seriesRestantes}
      />

    </aside>
  )

  return (
    <PageLoadingBoundary loading={loading} loadingMessage="Carregando...">

        {/* HEADER */}
        <WorkoutHeader
          nomeTreino={treino.nome}
          status={treinoAtivo.status}
          onSair={treinoAtivo.cancelarTreino}
          salvando={salvando}
        />

        <SessionFeedback
          erro={feedbackControle}
          aviso={treinoAtivo.aviso}
          onClose={() => { treinoAtivo.limparFeedback(); quickControls.clearFeedback() }}
        />

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">

          {fromPush ? [sessionControls, exerciseContext] : [exerciseContext, sessionControls]}

        </div>

        {/* MODAL INICIAL */}
        <PreWorkoutModal
          open={
            modalInicialOpen &&
            treinoAtivo.status === 'idle' &&
            !treinoAtivo.sessaoConflitante
          }
          treino={treino}
          descansoPadrao={descansoPadrao}
          onClose={() => {
            setModalInicialOpen(false)
            navigate('/treinar')
          }}
          processando={salvando}
          onStart={async (descanso) => {
            const iniciou = await treinoAtivo.iniciarTreino(descanso)
            if (iniciou) setModalInicialOpen(false)
          }}
        />

        <WorkoutSessionRecoveryModal
          sessao={treinoAtivo.sessaoConflitante}
          processando={salvando}
          onContinuar={() => {
            navigate(`/treinar/${treinoAtivo.sessaoConflitante.id_treino}`, {
              replace: true,
            })
          }}
          onCancelar={treinoAtivo.cancelarSessaoConflitante}
        />
    </PageLoadingBoundary>
  )
}
