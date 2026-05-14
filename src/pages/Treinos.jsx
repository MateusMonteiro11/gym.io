import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Sidebar from '../components/Sidebar'
import AgendarTreinoModal from '../components/AgendarTreinoModal'

import { useTreino } from '../hooks/useTreino'

import {
  criarTreino
} from '../services/treinos/treinosService'

import {
  criarSecao
} from '../services/treinos/secoesService'

import {
  adicionarExercicio
} from '../services/treinos/treinosExerciciosService'

import {
  listarExercicios
} from '../services/exercicios/exerciciosService'

import { criarAgendamento } from '../services/agendamentos/agendamentosService'

import { useAuth } from '../hooks/useAuth'

export default function Treinos() {

  const navigate = useNavigate()

  const { usuario } = useAuth()

  const {
    treinosSistema,
    meusTreinos,
    loading
  } = useTreino()

  const [modalAgendamentoOpen, setModalAgendamentoOpen] = useState(false)
  const [treinoSelecionado, setTreinoSelecionado] = useState(null)
  const [modalCriarTreinoOpen, setModalCriarTreinoOpen] = useState(false)

  async function handleCriarTreino() {
    setModalCriarTreinoOpen(true)
  }

  function handleAgendarTreino(treino) {
    setTreinoSelecionado(treino)
    setModalAgendamentoOpen(true)
  }

  async function handleConfirmarAgendamento(dados) {
    if (!usuario?.id || !treinoSelecionado?.id_treino) return

    try {
      await criarAgendamento({
        idUsuario: usuario.id,
        idTreino: treinoSelecionado.id_treino,
        dataAgendada: dados.dataAgendada,
      })

      setModalAgendamentoOpen(false)
      setTreinoSelecionado(null)
      alert('Treino agendado com sucesso!')
    } catch (error) {
      console.error('Erro ao agendar treino:', error)
      alert(`Erro ao agendar treino: ${error?.message || 'Tente novamente.'}`)
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
                  onAgendar={handleAgendarTreino}
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
                  onAgendar={handleAgendarTreino}
                />

              ))
            }

          </div>

        </div>

        <AgendarTreinoModal
          open={modalAgendamentoOpen}
          treino={treinoSelecionado}
          onClose={() => {
            setModalAgendamentoOpen(false)
            setTreinoSelecionado(null)
          }}
          onAgendar={handleConfirmarAgendamento}
        />

        <ModalCriarTreino
          open={modalCriarTreinoOpen}
          onClose={() => setModalCriarTreinoOpen(false)}
          usuario={usuario}
        />

      </main>

    </div>
  )
}

function WorkoutCard({
  workout,
  showActions = false,
  viewPath,
  editPath,
  onAgendar
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

      <div className="flex flex-wrap gap-2">

        <Link
          to={viewPath}
          className="flex-1 min-w-[130px] border rounded-lg py-2 text-sm text-center font-semibold text-gray-700 hover:bg-gray-100 transition-all"
        >
          Visualizar
        </Link>

        {onAgendar && (
          <button
            type="button"
            onClick={() => onAgendar(workout)}
            className="flex-1 min-w-[130px] border border-blue-500 text-blue-600 rounded-lg py-2 text-sm font-semibold hover:bg-blue-50 transition-all"
          >
            Agendar
          </button>
        )}

        {
          showActions && editPath && !isSystemWorkout && (

            <Link
              to={editPath}
              className="flex-1 min-w-[130px] bg-black text-white rounded-lg py-2 text-sm text-center hover:bg-gray-800 transition-all"
            >
              Editar
            </Link>

          )
        }

      </div>

    </div>
  )
}

function ModalCriarTreino({ open, onClose, usuario }) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [workoutName, setWorkoutName] = useState('Novo treino')
  const [workoutDescription, setWorkoutDescription] = useState('')
  const [sections, setSections] = useState([])
  const [exercicios, setExercicios] = useState([])
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionDescription, setNewSectionDescription] = useState('')

  useEffect(() => {
    if (open) {
      carregarExercicios()
    }
  }, [open])

  async function carregarExercicios() {
    try {
      const exerciciosData = await listarExercicios()
      setExercicios(Array.isArray(exerciciosData) ? exerciciosData : [])
    } catch (error) {
      console.error(error)
      alert('Erro ao carregar exercícios.')
    }
  }

  async function handleSaveSection() {
    if (!newSectionName.trim()) {
      alert('Informe um nome para a seção.')
      return
    }

    if (editingSection) {
      setSections(sections.map(s => s.id_secao === editingSection.id_secao ? { ...s, nome: newSectionName, descricao: newSectionDescription } : s))
    } else {
      const newSection = {
        id_secao: Date.now(), // temp id
        nome: newSectionName,
        descricao: newSectionDescription,
        treinos_exercicios: []
      }
      setSections([...sections, newSection])
    }

    setShowSectionModal(false)
    setEditingSection(null)
    setNewSectionName('')
    setNewSectionDescription('')
  }

  function handleAddExercise(idSecao, idExercicio) {
    const exercise = exercicios.find(e => e.id_exercicio === idExercicio)
    if (!exercise) return

    setSections(sections.map(s => {
      if (s.id_secao === idSecao) {
        const newExercise = {
          id_treino_exercicio: Date.now(), // temp id
          exercicios: exercise,
          series: 4,
          repeticoes: 12
        }
        return { ...s, treinos_exercicios: [...s.treinos_exercicios, newExercise] }
      }
      return s
    }))
  }

  function handleRemoveExercise(idTreinoExercicio) {
    setSections(sections.map(s => ({
      ...s,
      treinos_exercicios: s.treinos_exercicios.filter(e => e.id_treino_exercicio !== idTreinoExercicio)
    })))
  }

  function handleEditSection(section) {
    setEditingSection(section)
    setNewSectionName(section.nome)
    setNewSectionDescription(section.descricao || '')
    setShowSectionModal(true)
  }

  function handleDeleteSection(idSecao) {
    setSections(sections.filter(s => s.id_secao !== idSecao))
  }

  async function handleSalvarTreino() {
    try {
      setSaving(true)

      // Validação
      const hasValidSections = sections.some(section => section.treinos_exercicios && section.treinos_exercicios.length > 0)
      if (!hasValidSections) {
        alert('O treino deve ter pelo menos uma seção com pelo menos um exercício.')
        return
      }

      // Criar treino
      const treino = await criarTreino({
        nome: workoutName,
        descricao: workoutDescription,
        publico: false,
        id_usuario: usuario.id
      })

      // Criar seções e exercícios
      for (const section of sections) {
        const secao = await criarSecao({
          id_treino: treino.id_treino,
          nome: section.nome,
          descricao: section.descricao,
          ordem: sections.indexOf(section) + 1
        })

        for (const exercise of section.treinos_exercicios) {
          await adicionarExercicio({
            id_treino: treino.id_treino,
            id_secao: secao.id_secao,
            id_exercicio: exercise.exercicios.id_exercicio,
            series: exercise.series,
            repeticoes: exercise.repeticoes,
            carga: 0,
            descanso_segundos: 60,
            ordem: section.treinos_exercicios.indexOf(exercise) + 1
          })
        }
      }

      alert('Treino criado com sucesso!')
      onClose()
      // Recarregar a página ou atualizar estado
      window.location.reload()

    } catch (error) {
      console.error(error)
      alert('Erro ao criar treino.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">Criar Novo Treino</h2>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] bg-gray-50 p-8">
            <label className="text-sm font-semibold text-gray-700">Nome do treino</label>
            <input
              type="text"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              className="mt-3 w-full rounded-3xl border border-gray-300 bg-white px-5 py-4 text-lg font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <label className="text-sm font-semibold text-gray-700 mt-6 block">Descrição do treino (opcional)</label>
            <textarea
              rows={4}
              value={workoutDescription}
              onChange={(e) => setWorkoutDescription(e.target.value)}
              placeholder="Adicione uma descrição breve para seu treino"
              className="mt-3 w-full rounded-3xl border border-gray-300 bg-white px-5 py-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
            />

            <button
              onClick={handleSalvarTreino}
              disabled={saving}
              className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Criar treino'}
            </button>
          </div>

          <div className="rounded-[2rem] bg-gray-50 p-8">
            <p className="text-sm text-gray-500 uppercase tracking-[0.18em]">Resumo</p>
            <p className="mt-4 text-3xl font-semibold">{sections.length} seções</p>
            <button
              type="button"
              onClick={() => {
                setEditingSection(null)
                setNewSectionName(`Seção ${sections.length + 1}`)
                setNewSectionDescription('')
                setShowSectionModal(true)
              }}
              className="mt-6 inline-flex items-center justify-center rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Adicionar nova seção
            </button>
          </div>
        </div>

        <div className="space-y-6 mt-6">
          {sections.map((section) => (
            <div key={section.id_secao} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{section.nome}</h3>
                  <p className="text-sm text-gray-500 mt-2">{section.descricao || 'Sem descrição'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditSection(section)}
                    className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(section.id_secao)}
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddExercise(section.id_secao, Number(e.target.value))
                      e.target.value = ''
                    }
                  }}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 bg-white"
                >
                  <option value="">Selecionar exercício</option>
                  {exercicios.map((exercise) => (
                    <option key={exercise.id_exercicio} value={exercise.id_exercicio}>
                      {exercise.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {section.treinos_exercicios?.map((item, index) => (
                  <div key={item.id_treino_exercicio} className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{item.exercicios?.nome}</p>
                      <p className="text-xs text-gray-400">{item.series || 4} séries • {item.repeticoes || 12} reps</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(item.id_treino_exercicio)}
                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {showSectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
              <h2 className="text-2xl font-bold">{editingSection ? 'Editar seção' : 'Nova seção'}</h2>
              <p className="text-gray-500 mt-2">Configure o nome e descrição da seção.</p>
              <div className="mt-6">
                <label className="text-sm font-semibold text-gray-700">Nome da seção</label>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>
              <div className="mt-5">
                <label className="text-sm font-semibold text-gray-700">Descrição</label>
                <textarea
                  value={newSectionDescription}
                  onChange={(e) => setNewSectionDescription(e.target.value)}
                  rows={4}
                  placeholder="Descrição opcional..."
                  className="mt-2 w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSectionModal(false)
                    setEditingSection(null)
                  }}
                  className="rounded-2xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSection}
                  className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  {editingSection ? 'Atualizar seção' : 'Criar seção'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}