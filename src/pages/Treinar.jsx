import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageLoadingBoundary from '../components/ui/PageLoadingBoundary'
import PreWorkoutModal from '../components/PreWorkoutModal'

import { listarTreinos } from '../services/treinos/treinosService'

import { useAuth } from '../hooks/useAuth'
import { useUi } from '../contexts/UiContext'
import { useAgendamentos } from '../hooks/useAgendamentos'
import { layout } from '../styles/layout'

function TreinoCard({ treino, onIniciar }) {

  const totalSecoes = treino.secoes_treino?.length || 0

  const totalExercicios = treino.secoes_treino?.reduce(
    (acc, secao) => acc + (secao.treinos_exercicios?.length || 0),
    0
  )

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">

      {/* Action Icon Header */}
      <div className="flex items-center justify-end gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 dark:border-slate-700/70 dark:bg-slate-950/70">
        <button
          onClick={() => onIniciar(treino)}
          title="Iniciar treino"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-all duration-200 text-xs font-medium"
        >
          <i className="fa-solid fa-play text-xs"></i>
          <span className="hidden sm:inline">Iniciar</span>
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4">

        <div className="flex items-start justify-between">

          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {treino.nome}
            </h3>

            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {treino.descricao || 'Sem descrição'}
            </p>
          </div>

          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-muted dark:bg-slate-800">
            <i className="fa-solid fa-dumbbell text-primary text-lg"></i>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/70 dark:bg-slate-950/70">
            <p className="text-slate-600 dark:text-slate-400">Exercícios</p>
            <strong className="text-slate-700 dark:text-slate-100">
              {totalExercicios}
            </strong>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/70 dark:bg-slate-950/70">
            <p className="text-slate-600 dark:text-slate-400">Seções</p>
            <strong className="text-slate-700 dark:text-slate-100">
              {totalSecoes}
            </strong>
          </div>

        </div>

      </div>

    </div>
  )
}

function EmptyScheduled() {

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700/70 dark:bg-slate-900/85">

      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800">
        <i className="fa-regular fa-calendar text-2xl text-slate-600 dark:text-slate-300"></i>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-slate-700 dark:text-slate-100">
        Sem treinos programados disponíveis
      </h3>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Você ainda não possui treinos programados.
      </p>

    </div>
  )
}

export default function Treinar() {
  const navigate = useNavigate()
  const { confirm, notify } = useUi()
  const { usuario } = useAuth()
  const {
    agendamentos,
    loading: loadingAgendamentos,
    excluirAgendamento,
  } = useAgendamentos()
  const [treinos, setTreinos] = useState([])
  const [loadingTreinos, setLoadingTreinos] = useState(true)
  const [treinoSelecionado, setTreinoSelecionado] = useState(null)
  const [modalDescansoOpen, setModalDescansoOpen] = useState(false)
  const [descansoPadrao, setDescansoPadrao] = useState(60)

  useEffect(() => {
    let active = true

    if (!usuario?.id) {
      setTreinos([])
      setLoadingTreinos(false)
      return undefined
    }

    setLoadingTreinos(true)

    async function carregarTreinos() {

      try {

        const data = await listarTreinos(usuario.id)

        if (active) setTreinos(data || [])

      } catch (error) {

        if (active) console.error(error)

      } finally {

        if (active) setLoadingTreinos(false)
      }
    }

    carregarTreinos()

    return () => {
      active = false
    }

  }, [usuario?.id])

  function handleIniciarTreino(treino) {

    setTreinoSelecionado(treino)

    setModalDescansoOpen(true)
  }
  return (
    <PageLoadingBoundary
      loading={loadingTreinos || loadingAgendamentos}
      loadingMessage="Carregando treinos..."
    >

        {/* HEADER */}
        <div className="mb-10">

          <h1 className="text-3xl font-bold text-slate-900">
            Treinar
          </h1>

          <p className="text-slate-600 mt-1">
            Escolha um treino para iniciar.
          </p>

        </div>

        {/* TREINOS DISPONÍVEIS */}
        <section className="mb-10">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Treinos disponíveis
              </h2>

              <p className="text-sm text-slate-600 mt-1">
                Seus treinos prontos para execução.
              </p>
            </div>

          </div>

          {/* Carregar treinos do usuário */}
          {treinos.length === 0 ? (

            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700/70 dark:bg-slate-900/85">

              <h3 className="mb-2 text-lg font-semibold text-slate-700 dark:text-slate-100">
                Nenhum treino encontrado
              </h3>

              <p className="text-sm text-slate-600 dark:text-slate-300">
                Crie um treino em “Treinos” para começar.
              </p>

            </div>

          ) : (

            <div className={layout.trainingGrid}>

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

            <h2 className="text-xl font-semibold text-slate-900">
              Treinos agendados
            </h2>

            <p className="text-sm text-slate-600 mt-1">
              Seus próximos treinos programados.
            </p>

          </div>

          {agendamentos.length === 0 ? (
            <EmptyScheduled />
          ) : (
            <div className={layout.trainingGrid}>
              {agendamentos.map((agendamento) => {
                const treino = agendamento.treino
                const [ano, mes, dia] = agendamento.data_agendada.split('-')
                const dataFormatada = `${dia}/${mes}/${ano}`
                return (
                  <div key={agendamento.id_agendamento} className="flex flex-col overflow-hidden rounded-2xl border border-blue-200 bg-white bg-gradient-to-br from-blue-50 transition-all hover:shadow-md dark:border-slate-700/70 dark:from-slate-900 dark:to-slate-950 dark:shadow-black/20">

                    {/* Action Icons Header */}
                    <div className="flex items-center justify-end gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 dark:border-slate-700/70 dark:bg-slate-950/70">
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Excluir agendamento',
                            message: 'Deseja remover este treino da sua agenda?',
                            confirmLabel: 'Excluir',
                            variant: 'danger',
                          })
                          if (!ok) return

                          try {
                            await excluirAgendamento(agendamento.id_agendamento)
                            notify({
                              title: 'Agendamento removido',
                              message: 'O treino foi retirado da sua agenda.',
                              type: 'success',
                            })
                          } catch (error) {
                            notify({
                              title: 'Não foi possível remover',
                              message: 'Não foi possível excluir o agendamento.',
                              type: 'error',
                            })
                          }
                        }}
                        title="Excluir agendamento"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all duration-200 text-xs font-medium"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                      <button
                        onClick={() => {
                          setDescansoPadrao(agendamento.tempo_descanso)
                          navigate(`/treinar/${treino?.id_treino}`, {
                            state: {
                              descansoPadrao: agendamento.tempo_descanso,
                            },
                          })
                        }}
                        title="Iniciar treino"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-all duration-200 text-xs font-medium"
                      >
                        <i className="fa-solid fa-play text-xs"></i>
                        <span className="hidden sm:inline">Iniciar</span>
                      </button>
                    </div>

                    <div className="p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                            {treino?.nome}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {treino?.descricao || 'Sem descrição'}
                          </p>
                        </div>
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-muted dark:bg-slate-800">
                          <i className="fa-solid fa-dumbbell text-primary text-lg"></i>
                        </div>
                      </div>

                      <div className="rounded-xl border border-blue-100 bg-white p-3 text-sm dark:border-slate-700/70 dark:bg-slate-950/70">
                        <p className="text-slate-600 dark:text-slate-400">Agendado para</p>
                        <strong className="text-slate-700 dark:text-slate-100">{dataFormatada}</strong>
                      </div>
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
    </PageLoadingBoundary>
  )
}
