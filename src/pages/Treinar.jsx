import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../components/Sidebar'
import PreWorkoutModal from '../components/PreWorkoutModal'

import { listarTreinos } from '../services/treinos/treinosService'

import { useAuth } from '../hooks/useAuth'
import { useAgendamentos } from '../hooks/useAgendamentos'

function TreinoCard({ treino, onIniciar }) {

  const totalSecoes = treino.secoes_treino?.length || 0

  const totalExercicios = treino.secoes_treino?.reduce(
    (acc, secao) => acc + (secao.treinos_exercicios?.length || 0),
    0
  )

  return (
    <div className="bg-white border rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md transition-all">

      <div className="flex items-start justify-between">

        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {treino.nome}
          </h3>

          <p className="text-sm text-gray-400 mt-1">
            {treino.descricao || 'Sem descrição'}
          </p>
        </div>

        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <i className="fa-solid fa-dumbbell text-blue-600 text-lg"></i>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">

        <div className="bg-gray-50 rounded-xl p-3 border">
          <p className="text-gray-400">Exercícios</p>
          <strong className="text-gray-700">
            {totalExercicios}
          </strong>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border">
          <p className="text-gray-400">Seções</p>
          <strong className="text-gray-700">
            {totalSecoes}
          </strong>
        </div>

      </div>

      <div className="flex items-center gap-3 pt-2">

        <button
          onClick={() => onIniciar(treino)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-medium transition-all"
        >
          <i className="fa-solid fa-play mr-2"></i>
          Iniciar treino
        </button>

      </div>

    </div>
  )
}

function EmptyScheduled() {

  return (
    <div className="bg-white border rounded-2xl p-10 text-center">

      <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <i className="fa-regular fa-calendar text-2xl text-gray-400"></i>
      </div>

      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        Sem treinos programados disponíveis
      </h3>

      <p className="text-gray-400 text-sm">
        Você ainda não possui treinos programados.
      </p>

    </div>
  )
}

export default function Treinar() {

  const navigate = useNavigate()

  const { usuario, loading } = useAuth()
  const {
    agendamentos,
    recarregar: recarregarAgendamentos,
    excluirAgendamento,
  } = useAgendamentos()
  const [treinos, setTreinos] = useState([])
  const [loadingTreinos, setLoadingTreinos] = useState(true)
  const [treinoSelecionado, setTreinoSelecionado] = useState(null)
  const [modalDescansoOpen, setModalDescansoOpen] = useState(false)
  const [descansoPadrao, setDescansoPadrao] = useState(60)

  useEffect(() => {

  if (loading || !usuario) return

    async function carregarTreinos() {

      try {

        const data = await listarTreinos(usuario.id)

        setTreinos(data || [])

      } catch (error) {

        console.error(error)

      } finally {

        setLoadingTreinos(false)
      }
    }

    carregarTreinos()

  }, [usuario, loading])

  function handleIniciarTreino(treino) {

    setTreinoSelecionado(treino)

    setModalDescansoOpen(true)
  }


  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">

      <Sidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">

        {/* HEADER */}
        <div className="mb-10">

          <h1 className="text-3xl font-bold text-gray-800">
            Treinar
          </h1>

          <p className="text-gray-400 mt-1">
            Escolha um treino para iniciar.
          </p>

        </div>

        {/* TREINOS DISPONÍVEIS */}
        <section className="mb-10">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Treinos disponíveis
              </h2>

              <p className="text-sm text-gray-400 mt-1">
                Seus treinos prontos para execução.
              </p>
            </div>

          </div>

          {/* Carregar treinos do usuário */}
          {loadingTreinos ? (

            <div className="text-gray-400">
              Carregando treinos...
            </div>

          ) : treinos.length === 0 ? (

            <div className="bg-white border rounded-2xl p-10 text-center">

              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Nenhum treino encontrado
              </h3>

              <p className="text-gray-400 text-sm">
                Crie um treino em “Treinos” para começar.
              </p>

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

              {treinos.map((treino) => (
                <TreinoCard
                  key={treino.id_treino}
                  treino={treino}
                  onIniciar={handleIniciarTreino}
                />
              ))}

            </div>

          )}

        </section>

        {/* TREINOS AGENDADOS */}
        <section>

          <div className="mb-5">

            <h2 className="text-xl font-semibold text-gray-800">
              Treinos agendados
            </h2>

            <p className="text-sm text-gray-400 mt-1">
              Seus próximos treinos programados.
            </p>

          </div>

          {agendamentos.length === 0 ? (
            <EmptyScheduled />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {agendamentos.map((agendamento) => {
                const treino = agendamento.treino
                const [ano, mes, dia] = agendamento.data_agendada.split('-')
                const dataFormatada = `${dia}/${mes}/${ano}`
                return (
                  <div key={agendamento.id_agendamento} className="bg-white border border-blue-200 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md transition-all bg-gradient-to-br from-blue-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {treino?.nome}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {treino?.descricao || 'Sem descrição'}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-dumbbell text-blue-600 text-lg"></i>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-blue-100 text-sm">
                      <p className="text-gray-400">Agendado para</p>
                      <strong className="text-gray-700">{dataFormatada}</strong>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => {
                          setDescansoPadrao(agendamento.tempo_descanso)
                          navigate(`/treinar/${treino?.id_treino}`, {
                            state: {
                              descansoPadrao: agendamento.tempo_descanso,
                            },
                          })
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-medium transition-all"
                      >
                        <i className="fa-solid fa-play mr-2"></i>
                        Iniciar treino
                      </button>

                      <button
                        onClick={async () => {
                          const confirmDelete = window.confirm(
                            'Deseja excluir este agendamento?'
                          )
                          if (!confirmDelete) return

                          try {
                            await excluirAgendamento(agendamento.id_agendamento)
                          } catch (error) {
                            alert('Não foi possível excluir o agendamento.')
                          }
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-medium transition-all"
                      >
                        <i className="fa-solid fa-trash mr-2"></i>
                        Excluir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <PreWorkoutModal
            open={modalDescansoOpen}
            treino={treinoSelecionado}
            descansoPadrao={descansoPadrao}
            onClose={() => setModalDescansoOpen(false)}
            onStart={(descanso) => {
              setDescansoPadrao(descanso)
              setModalDescansoOpen(false)

              if (treinoSelecionado) {
                navigate(`/treinar/${treinoSelecionado.id_treino}`, {
                  state: {
                    descansoPadrao: descanso,
                  },
                })
              }
            }}
          />

  
        </section>

      </main>

    </div>
  )
}