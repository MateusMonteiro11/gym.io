import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'

import DashboardLayout from '../layouts/DashboardLayout'

import WorkoutHeader from '../components/WorkoutHeader'
import CurrentExerciseCard from '../components/CurrentExerciseCard'
import WorkoutProgress from '../components/WorkoutProgress'
import WorkoutTimer from '../components/WorkoutTimer'
import WorkoutActions from '../components/WorkoutActions'
import WorkoutInfo from '../components/WorkoutInfo'
import WorkoutSectionInfo from '../components/WorkoutSectionInfo'
import DescansoModal from '../components/DescansoModal'
import PreWorkoutModal from '../components/PreWorkoutModal'

import { useAuth } from '../hooks/useAuth'

import { buscarTreinoCompleto } from '../services/treinos/treinosService'

import { useTreinoAtivo } from '../hooks/useTreinoAtivo'
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

  const shouldBlockNavigation = treinoAtivo.status === 'ativo' || treinoAtivo.status === 'descansando'

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!shouldBlockNavigation) return
      event.preventDefault()
      event.returnValue = 'Seu treino será perdido se você sair.'
      return 'Seu treino será perdido se você sair.'
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldBlockNavigation])

  if (authLoading || loading || !usuario?.id) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Carregando treino...</p>
      </div>
    )
  }

  if (!treino) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">

        <div className="bg-white border rounded-2xl p-8 text-center max-w-md">

          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Treino não encontrado
          </h2>

          <p className="text-slate-600 mb-5">
            O treino solicitado não existe ou foi removido.
          </p>

          <button
            onClick={() => navigate('/treinar')}
            className="bg-primary hover:bg-primary-hover text-white px-5 py-3 rounded-xl"
          >
            Voltar
          </button>

        </div>

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
          secaoAtual={treinoAtivo.estado.secaoAtual}
          proximaSecao={treinoAtivo.estado.proximaSecao}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">

          {/* ESQUERDA */}
          <div className="lg:col-span-2 space-y-6">

            <WorkoutProgress
              percentual={treinoAtivo.estado.percentual}
              exerciciosFeitos={treinoAtivo.estado.exerciciosFeitos}
              totalExercicios={treinoAtivo.estado.totalExercicios}
            />

            <CurrentExerciseCard
              exercicio={treinoAtivo.exercicioAtual}
              serieAtual={treinoAtivo.serieAtual}
              status={treinoAtivo.status}
              tempoDescanso={treinoAtivo.tempoDescanso}
              onConcluirSerie={treinoAtivo.concluirSerie}
            />

          </div>

          {/* DIREITA */}
          <div className="space-y-6">

            <WorkoutTimer
              formatted={treinoAtivo.workoutTimer.formatted}
              isRunning={treinoAtivo.workoutTimer.isRunning}
              status={treinoAtivo.status}

              onToggle={treinoAtivo.workoutTimer.toggle}
            />

            <WorkoutSectionInfo
              secaoAtual={treinoAtivo.estado.secaoAtual}
              proximaSecao={treinoAtivo.estado.proximaSecao}
            />

            <WorkoutInfo
              exerciciosRestantes={treinoAtivo.estado.exerciciosRestantes}
              seriesRestantes={treinoAtivo.estado.seriesRestantes}
            />

            <WorkoutActions
                status={treinoAtivo.status}
                indexAtual={treinoAtivo.indexAtual}
                finalizado={treinoAtivo.finalizado}
                salvando={treinoAtivo.salvando}

                onIniciar={() => treinoAtivo.iniciarTreino(descansoPadrao)}

                onAvancar={treinoAtivo.avancarExercicio}
                onFinalizar={treinoAtivo.finalizarTreino}
            />

          </div>

        </div>

        {/* MODAL INICIAL */}
        <PreWorkoutModal
          open={modalInicialOpen && treinoAtivo.status === 'idle'}
          treino={treino}
          descansoPadrao={descansoPadrao}
          onClose={() => {
            setModalInicialOpen(false)
            navigate('/treinar')
          }}
          onStart={(descanso) => {
            treinoAtivo.iniciarTreino(descanso)
            setModalInicialOpen(false)
          }}
        />

        {/* MODAL DESCANSO */}
        {treinoAtivo.status === 'descansando' && (

          <DescansoModal

            restante={
              treinoAtivo.descansoTimer.restante
            }

            total={
              treinoAtivo.descansoTimer.total
            }

            percentual={
              treinoAtivo.descansoTimer.percentual
            }

            formatted={
              treinoAtivo.descansoTimer.formatted
            }

            ativo={
              treinoAtivo.descansoTimer.ativo
            }

            onAdicionarTempo={
              treinoAtivo.descansoTimer.adicionarTempo
            }

            onRemoverTempo={
              treinoAtivo.descansoTimer.removerTempo
            }

            onPular={
              treinoAtivo.pularDescanso
            }

            onContinuar={
              treinoAtivo.continuarSerie
            }

          />

        )}
    </DashboardLayout>
  )
}