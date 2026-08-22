import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'

import DashboardLayout from '../layouts/DashboardLayout'

import WorkoutHeader from '../components/WorkoutHeader'
import CurrentExerciseCard from '../components/CurrentExerciseCard'
import WorkoutProgress from '../components/WorkoutProgress'
import WorkoutTimer from '../components/WorkoutTimer'
import WorkoutActions from '../components/WorkoutActions'
import WorkoutInfo from '../components/WorkoutInfo'
import PreWorkoutModal from '../components/PreWorkoutModal'
import WorkoutSessionRecoveryModal from '../components/WorkoutSessionRecoveryModal'
import SessionFeedback from '../components/SessionFeedback'

import { useAuth } from '../hooks/useAuth'

import { buscarTreinoCompleto } from '../services/treinos/treinosService'

import { useTreinoAtivo } from '../hooks/useTreinoAtivo'
import { ordemSecaoParaApresentacao } from '../hooks/treinoSessaoControllerUtils'
import { logError } from '../utils/errorMessages'

export default function TreinoPlayer() {

  const navigate = useNavigate()

  const { id } = useParams()

  const { usuario, loading: authLoading } = useAuth()

  const [treino, setTreino] = useState(null)
  const [loading, setLoading] = useState(true)

  const location = useLocation()
  const from = `${location.pathname}${location.search}`
  const descansoPadrao = location.state?.descansoPadrao ?? 60
  const [modalInicialOpen, setModalInicialOpen] = useState(
    location.state?.descansoPadrao == null
  )

  useEffect(() => {
    if (authLoading) return

    if (!usuario?.id) {
      navigate('/login', { state: { from }, replace: true })
      return
    }

    async function carregarTreino() {

      try {

        const data = await buscarTreinoCompleto(id)

        setTreino(data)

      } catch (error) {

        logError(error, '[TreinoPlayer] Failed to load workout')

      } finally {

        setLoading(false)
      }
    }

    carregarTreino()

  }, [authLoading, from, id, navigate, usuario?.id])

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

  if (authLoading || loading || !usuario?.id) {

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">Carregando treino...</p>
      </div>
    )
  }

  if (!treino) {

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">

        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700/70 dark:bg-slate-900/85">

          <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-50">
            Treino não encontrado
          </h2>

          <p className="mb-5 text-slate-600 dark:text-slate-300">
            O treino solicitado não existe ou foi removido.
          </p>

          <button
            onClick={() => navigate('/treinar')}
            className="rounded-xl bg-primary px-5 py-3 text-white hover:bg-primary-hover"
          >
            Voltar
          </button>

        </div>

      </div>
    )
  }

  if (treinoAtivo.carregandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">Recuperando sessão...</p>
      </div>
    )
  }

  return (
    <DashboardLayout loading={loading} loadingMessage="Carregando...">

        {/* HEADER */}
        <WorkoutHeader
          nomeTreino={treino.nome}
          status={treinoAtivo.status}
          onSair={treinoAtivo.cancelarTreino}
          salvando={treinoAtivo.salvando}
        />

        <SessionFeedback
          erro={treinoAtivo.erro}
          aviso={treinoAtivo.aviso}
          onClose={treinoAtivo.limparFeedback}
        />

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">

          {/* CONTEXTO PRINCIPAL */}
          <div className="space-y-5 lg:col-span-2">
            <WorkoutProgress
              percentual={treinoAtivo.estado.percentual}
              exerciciosFeitos={treinoAtivo.estado.exerciciosFeitos}
              totalExercicios={treinoAtivo.estado.totalExercicios}
              serieAtual={treinoAtivo.serieAtual}
              totalSeries={treinoAtivo.exercicioAtual?.series ?? 0}
            />

            <CurrentExerciseCard
              exercicio={treinoAtivo.exercicioAtual}
              serieAtual={treinoAtivo.serieAtual}
              status={treinoAtivo.status}
              tempoDescanso={treinoAtivo.tempoDescanso}
              onConcluirSerie={treinoAtivo.concluirSerie}
              processando={treinoAtivo.salvando}
              pausado={treinoAtivo.pausado}
            />
          </div>

          {/* ESTADO E AÇÕES: no mobile, sempre antes das informações complementares */}
          <aside className="space-y-4 lg:col-start-3 lg:sticky lg:top-5">

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
              disabled={treinoAtivo.salvando}
            />

            <WorkoutActions
                status={treinoAtivo.status}
                indexAtual={treinoAtivo.indexAtual}
                finalizado={treinoAtivo.finalizado}
                salvando={treinoAtivo.salvando}
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
          processando={treinoAtivo.salvando}
          onStart={async (descanso) => {
            const iniciou = await treinoAtivo.iniciarTreino(descanso)
            if (iniciou) setModalInicialOpen(false)
          }}
        />

        <WorkoutSessionRecoveryModal
          sessao={treinoAtivo.sessaoConflitante}
          processando={treinoAtivo.salvando}
          onContinuar={() => {
            navigate(`/treinar/${treinoAtivo.sessaoConflitante.id_treino}`, {
              replace: true,
            })
          }}
          onCancelar={treinoAtivo.cancelarSessaoConflitante}
        />
    </DashboardLayout>
  )
}
