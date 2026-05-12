import { Link, useNavigate } from 'react-router-dom'

import Sidebar from '../components/Sidebar'

import { useTreino } from '../hooks/useTreino'

import {
  criarTreino
} from '../services/treinos/treinosService'

import { useAuth } from '../hooks/useAuth'

export default function Treinos() {

  const navigate = useNavigate()

  const { usuario } = useAuth()

  const {
    treinosSistema,
    meusTreinos,
    loading
  } = useTreino()

  async function handleCriarTreino() {

    try {

      const treino =
        await criarTreino({

          nome: 'Novo treino',

          descricao: '',

          publico: false,

          id_usuario: usuario.id

        })

      navigate(
        `/treinos/editar/${treino.id_treino}`
      )

    } catch (error) {

      console.error(error)

      alert(
        'Erro ao criar treino.'
      )
    }
  }

  if (loading) {
    return (
      <div className="p-10">
        Carregando treinos...
      </div>
    )
  }

  return (

    <div className="flex min-h-screen bg-gray-100">

      <Sidebar />

      <main className="flex-1 p-8">

        {/* Header */}
        <div className="mb-8">

          <h1 className="text-3xl font-bold">
            Treinos
          </h1>

          <p className="text-gray-400">
            Gerencie seus treinos personalizados
          </p>

        </div>

        {/* SISTEMA */}

        <div className="mb-12">

          <h2 className="text-xl font-semibold">
            Treinos do sistema
          </h2>

          <p className="text-gray-400 text-sm mb-6">
            Templates prontos
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {
              treinosSistema.map((treino) => (

                <WorkoutCard
                  key={treino.id_treino}
                  workout={treino}
                  viewPath={`/treinos/visualizar/${treino.id_treino}`}
                  showActions={false}
                />

              ))
            }

          </div>

        </div>

        {/* USUARIO */}

        <div>

          <div className="flex justify-between items-center mb-6">

            <div>

              <h2 className="text-xl font-semibold">
                Meus treinos
              </h2>

              <p className="text-gray-400 text-sm">
                Treinos criados por você
              </p>

            </div>

            <button
                onClick={handleCriarTreino}
                className="
                  btn-action
                  bg-black
                  text-white
                  px-5
                  py-2
                  rounded-lg
                  hover:bg-gray-800
                "
              >
              + Criar Novo Treino
            </button>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {
              meusTreinos.map((treino) => (

                <WorkoutCard
                  key={treino.id_treino}
                  workout={treino}
                  showActions
                  viewPath={`/treinos/visualizar/${treino.id_treino}`}
                  editPath={`/treinos/editar/${treino.id_treino}`}
                />

              ))
            }

          </div>

        </div>

      </main>

    </div>
  )
}

function WorkoutCard({
  workout,
  showActions = false,
  viewPath,
  editPath
}) {

  const isSystemWorkout =
    workout?.tipo?.toLowerCase() === 'sistema'

  return (

    <div className="card bg-white border rounded-2xl p-5 relative">

      <h3 className={`font-semibold ${showActions ? 'mt-4' : ''}`}>
        {workout.nome}
      </h3>

      <p className="text-sm text-gray-400 mb-4">
        {workout.descricao}
      </p>

      <div className="flex gap-2">

        <Link
          to={viewPath}
          className="flex-1 border rounded-lg py-2 text-sm text-center font-semibold text-gray-700 hover:bg-gray-100"
        >
          Visualizar
        </Link>

        {
          showActions && editPath && !isSystemWorkout && (

            <Link
              to={editPath}
              className="flex-1 bg-black text-white rounded-lg py-2 text-sm text-center hover:bg-gray-800"
            >
              Editar
            </Link>

          )
        }

      </div>

    </div>
  )
}