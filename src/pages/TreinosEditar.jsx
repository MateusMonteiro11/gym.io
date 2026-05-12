// TreinosEditar.jsx

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import Sidebar from '../components/Sidebar'

import {
  buscarTreinoCompleto,
  criarTreino,
  editarTreino,
  deletarTreino
} from '../services/treinos/treinosService'

import {
  criarSecao,
  editarSecao,
  deletarSecao
} from '../services/treinos/secoesService'

import {
  adicionarExercicio,
  removerExercicio
} from '../services/treinos/treinosExerciciosService'

import {
  listarExercicios
} from '../services/exercicios/exerciciosService'

import { useAuth } from '../hooks/useAuth'

function SectionEditor({
  section,
  exerciciosDisponiveis,
  onAddExercise,
  onRemoveExercise,
  onEditSection,
  onDeleteSection
}) {

  const [selectedExercise, setSelectedExercise] =
    useState('')

  return (

    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">

        <div>

          <h3 className="text-xl font-semibold">
            {section.nome}
          </h3>

          <p className="text-sm text-gray-500 mt-2">
            {section.descricao || 'Sem descrição'}
          </p>

        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEditSection(section)}
            className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={() => onDeleteSection(section.id_secao)}
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Excluir
          </button>
        </div>

      </div>

      <div className="flex gap-3 mb-6">

        <select
          value={selectedExercise}
          onChange={(e) =>
            setSelectedExercise(e.target.value)
          }
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
        >

          <option value="">
            Selecionar exercício
          </option>

          {Array.isArray(exerciciosDisponiveis) &&
            exerciciosDisponiveis.map((exercise) => (

            <option
              key={exercise.id_exercicio}
              value={exercise.id_exercicio}
            >
              {exercise.nome}
            </option>

          ))}

        </select>

        <button
          type="button"
          onClick={() => {

            if (!selectedExercise) return

            onAddExercise(
              section.id_secao,
              Number(selectedExercise)
            )

            setSelectedExercise('')
          }}
          className="rounded-xl bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700"
        >
          + Adicionar
        </button>

      </div>

      <div className="space-y-3">

        {section.treinos_exercicios?.map(
          (item, index) => (

            <div
              key={item.id_treino_exercicio}
              className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >

              <div>

                <p className="font-medium">
                  {item.exercicios?.nome}
                </p>

                <p className="text-xs text-gray-400">
                  {item.series || 4} séries •{' '}
                  {item.repeticoes || 12} reps
                </p>

              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-gray-500">
                  #{index + 1}
                </span>

                <button
                  type="button"
                  onClick={() => onRemoveExercise(item.id_treino_exercicio)}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Excluir
                </button>
              </div>

            </div>

          )
        )}

      </div>

    </div>

  )
}

export default function TreinosEditar() {

  const { id } = useParams()

  const navigate = useNavigate()

  const { usuario } = useAuth()

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [workoutName, setWorkoutName] =
    useState('')

  const [sections, setSections] = useState([])

  const [exercicios, setExercicios] =
    useState([])

  const [showSectionModal, setShowSectionModal] = useState(false)

  const [editingSection, setEditingSection] = useState(null)

  const [newSectionName, setNewSectionName] = useState(
    `Seção ${sections.length + 1}`
  )

  const [newSectionDescription, setNewSectionDescription] =
    useState('')

  async function carregarTreino() {

    try {

      setLoading(true)

      if (id) {

        const treino =
          await buscarTreinoCompleto(id)

        if (treino.tipo?.toLowerCase() === 'sistema') {
          alert(
            'Treinos do sistema são fixos e não podem ser editados.'
          )
          navigate(`/treinos/visualizar/${id}`)
          return
        }

        setWorkoutName(treino.nome)

        setSections(
          treino.secoes_treino || []
        )
      }

      const exerciciosData =
        await listarExercicios()

      setExercicios(
        Array.isArray(exerciciosData)
          ? exerciciosData
          : []
      )

    } catch (error) {

      console.error(error)

      alert('Erro ao carregar treino.')

    } finally {

      setLoading(false)
    }
  }

  useEffect(() => {

    carregarTreino()

  }, [id])

  async function handleSalvarTreino() {

    try {

      setSaving(true)

      if (id) {

        await editarTreino(id, {
          nome: workoutName
        })

        alert('Treino atualizado!')

      } else {

        const treinoCriado =
          await criarTreino({

            nome: workoutName,

            descricao: '',

            publico: false,

            id_usuario: usuario.id_usuario
          })

        navigate(
          `/treinos/editar/${treinoCriado.id_treino}`
        )

        return
      }

    } catch (error) {

      console.error(error)

      alert('Erro ao salvar treino.')

    } finally {

      setSaving(false)
    }
  }

  async function handleSaveSection() {

    try {

      if (!id) {

        alert(
          'Salve o treino antes de adicionar seções.'
        )

        return
      }

      if (!newSectionName.trim()) {

        alert('Informe um nome para a seção.')

        return
      }

      if (editingSection) {
        await editarSecao(editingSection.id_secao, {
          nome: newSectionName,
          descricao: newSectionDescription
        })
      } else {
        await criarSecao({
          id_treino: id,
          nome: newSectionName,
          descricao: newSectionDescription,
          ordem: sections.length + 1
        })
      }

      setShowSectionModal(false)
      setEditingSection(null)

      await carregarTreino()

    } catch (error) {

      console.error(error)

      alert(
        editingSection
          ? 'Erro ao atualizar seção.'
          : 'Erro ao criar seção.'
      )
    }
  }

  async function handleAddExercise(
    idSecao,
    idExercicio
  ) {

    try {

      await adicionarExercicio({

        id_treino: id,

        id_secao: idSecao,

        id_exercicio: idExercicio,

        series: 4,

        repeticoes: 12,

        carga: 0,

        descanso_segundos: 60,

        ordem: 1
      })

      await carregarTreino()

    } catch (error) {

      console.error(error)

      alert(
        'Erro ao adicionar exercício.'
      )
    }
  }

  async function handleRemoveExercise(
    idTreinoExercicio
  ) {
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir este exercício?'
    )

    if (!confirmed) return

    try {
      await removerExercicio(idTreinoExercicio)
      await carregarTreino()
    } catch (error) {
      console.error(error)
      alert('Erro ao remover exercício.')
    }
  }

  async function handleEditSection(section) {
    setEditingSection(section)
    setNewSectionName(section.nome)
    setNewSectionDescription(section.descricao || '')
    setShowSectionModal(true)
  }

  async function handleDeleteSection(idSecao) {
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir esta seção?'
    )

    if (!confirmed) return

    try {
      await deletarSecao(idSecao)
      await carregarTreino()
    } catch (error) {
      console.error(error)
      alert('Erro ao excluir seção.')
    }
  }

  async function handleDeleteTreino() {
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir este treino permanentemente?'
    )

    if (!confirmed || !id) return

    try {
      await deletarTreino(id)
      navigate('/treinos')
    } catch (error) {
      console.error(error)
      alert('Erro ao excluir treino.')
    }
  }

  if (loading) {

    return (

      <div className="min-h-screen flex items-center justify-center">
        Carregando treino...
      </div>

    )
  }

  return (

    <div className="flex min-h-screen bg-gray-100">

      <Sidebar />

      <main className="flex-1 p-8">

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-sm text-blue-600 font-semibold">
              Editar treinos
            </p>

            <h1 className="text-3xl font-bold mt-3">
              Personalize seu treino
            </h1>

            <p className="text-gray-400 mt-2">
              Ajuste seções e exercícios.
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              to="/treinos"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Voltar
            </Link>

            {id && (

              <Link
                to={`/treinos/visualizar/${id}`}
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
              >
                Visualizar treino
              </Link>

            )}

            {id && (
              <button
                type="button"
                onClick={handleDeleteTreino}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Excluir treino
              </button>
            )}

          </div>

        </div>

        <section className="mb-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">

          <div className="rounded-[2rem] bg-white p-8 shadow-sm border border-gray-200">

            <label className="text-sm font-semibold text-gray-700">
              Nome do treino
            </label>

            <input
              type="text"
              value={workoutName}
              onChange={(e) =>
                setWorkoutName(e.target.value)
              }
              className="mt-3 w-full rounded-3xl border border-gray-300 bg-gray-50 px-5 py-4 text-lg font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              onClick={handleSalvarTreino}
              disabled={saving}
              className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >

              {saving
                ? 'Salvando...'
                : 'Salvar treino'}

            </button>

          </div>

          <div className="rounded-[2rem] bg-white p-8 shadow-sm border border-gray-200">

            <p className="text-sm text-gray-500 uppercase tracking-[0.18em]">
              Resumo
            </p>

            <p className="mt-4 text-3xl font-semibold">
              {sections.length} seções
            </p>

            <button
              type="button"
              onClick={() => {
                setEditingSection(null)
                setNewSectionName(
                  `Seção ${sections.length + 1}`
                )
                setNewSectionDescription('')
                setShowSectionModal(true)
              }}
              className="mt-6 inline-flex items-center justify-center rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Adicionar nova seção
            </button>

          </div>

        </section>

        <section className="space-y-6">

          {sections.map((section) => (

            <SectionEditor
              key={section.id_secao}
              section={section}
              exerciciosDisponiveis={exercicios}
              onAddExercise={handleAddExercise}
              onRemoveExercise={handleRemoveExercise}
              onEditSection={handleEditSection}
              onDeleteSection={handleDeleteSection}
            />

          ))}

        </section>

      </main>

      {showSectionModal && (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">

      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">

        <h2 className="text-2xl font-bold">
          {editingSection ? 'Editar seção' : 'Nova seção'}
        </h2>

        <p className="text-gray-500 mt-2">
          Configure o nome e descrição da seção.
        </p>

        <div className="mt-6">

          <label className="text-sm font-semibold text-gray-700">
            Nome da seção
          </label>

          <input
            type="text"
            value={newSectionName}
            onChange={(e) =>
              setNewSectionName(e.target.value)
            }
            className="mt-2 w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 outline-none focus:border-blue-500"
          />

        </div>

        <div className="mt-5">

          <label className="text-sm font-semibold text-gray-700">
            Descrição
          </label>

          <textarea
            value={newSectionDescription}
            onChange={(e) =>
              setNewSectionDescription(e.target.value)
            }
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

    </div>

  )
}