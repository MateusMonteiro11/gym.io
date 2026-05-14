import { useEffect, useState } from 'react' 
import { useNavigate, useParams } from 'react-router-dom'

import Sidebar from '../components/Sidebar'

import WorkoutHeader from '../components/WorkoutHeader'
import CurrentExerciseCard from '../components/CurrentExerciseCard'
import NextExercisesList from '../components/NextExerciseList'
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

import { useLocation } from 'react-router-dom'

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

    async function carregarTreino() {

      try {

        const data = await buscarTreinoCompleto(id)

        setTreino(data)

      } catch (error) {

        console.error(error)

      } finally {

        setLoading(false)
      }
    }

    carregarTreino()

  }, [id])

  const treinoAtivo = useTreinoAtivo({
    treino,
    idUsuario: usuario?.id,
    descansoPadrao,

    onFinalizar: () => {
      navigate('/treinar')
    }

  })

  if (loading) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-400">Carregando treino...</p>
      </div>
    )
  }

  if (!treino) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">

        <div className="bg-white border rounded-2xl p-8 text-center max-w-md">

          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Treino não encontrado
          </h2>

          <p className="text-gray-400 mb-5">
            O treino solicitado não existe ou foi removido.
          </p>

          <button
            onClick={() => navigate('/treinar')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl"
          >
            Voltar
          </button>

        </div>

      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100">

      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">

        {/* HEADER */}
        <WorkoutHeader
          nomeTreino={treino.nome}
          status={treinoAtivo.status}
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

      </main>

    </div>
  )
}