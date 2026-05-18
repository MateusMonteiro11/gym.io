import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import DashboardLayout from '../layouts/DashboardLayout'

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
import { useUi } from '../contexts/UiContext'

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

    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">

        <div>

          <h3 className="text-xl font-semibold">
            {section.nome}
          </h3>

          <p className="text-sm text-slate-600 mt-2">
            {section.descricao || 'Sem descrição'}
          </p>

        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEditSection(section)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
          className="flex-1 border border-slate-200 rounded-xl px-4 py-3 bg-slate-50"
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
          className="rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary-hover"
        >
          + Adicionar
        </button>

      </div>

      <div className="space-y-3">

        {section.treinos_exercicios?.map(
          (item, index) => (

            <div
              key={item.id_treino_exercicio}
              className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >

              <div>

                <p className="font-medium">
                  {item.exercicios?.nome}
                </p>

                <p className="text-xs text-slate-600">
                  {item.series || 4} séries •{' '}
                  {item.repeticoes || 12} reps
                </p>

              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-slate-600">
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
  const { alert, notify } = useUi()
  const { usuario } = useAuth()

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [workoutName, setWorkoutName] =
    useState('')

  const [workoutDescription, setWorkoutDescription] =
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
        setWorkoutDescription(treino.descricao || '')

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

      alert({ title: 'Erro', message: 'Erro ao carregar treino.', type: 'error' })

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

      // Validação: verificar se há pelo menos uma seção com pelo menos um exercício
      const hasValidSections = sections.some(section => section.treinos_exercicios && section.treinos_exercicios.length > 0)
      if (!hasValidSections) {
        alert({ title: 'Treino incompleto', message: 'O treino deve ter pelo menos uma seção com pelo menos um exercício.', type: 'warning' })
        return
      }

      if (id) {

        await editarTreino(id, {
          nome: workoutName,
          descricao: workoutDescription,
        })

        notify({ title: 'Sucesso', message: 'Treino atualizado!', type: 'success' })

      } else {

        const treinoCriado =
          await criarTreino({

            nome: workoutName,

            descricao: workoutDescription,

            publico: false,

            id_usuario: usuario.id
          })

        navigate(
          `/treinos/editar/${treinoCriado.id_treino}`
        )

        return
      }

    } catch (error) {

      console.error(error)

      alert({ title: 'Erro', message: 'Erro ao salvar treino.', type: 'error' })

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

        alert({ title: 'Nome obrigatório', message: 'Informe um nome para a seção.', type: 'warning' })

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
    const confirmed = await confirm({
      title: 'Remover exercício',
      message: 'Tem certeza que deseja excluir este exercício? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'warning'
    })

    if (!confirmed) return

    try {
      await removerExercicio(idTreinoExercicio)
      await carregarTreino()
    } catch (error) {
      console.error(error)
      alert({ title: 'Erro', message: 'Erro ao remover exercício.', type: 'error' })
    }
  }

  async function handleEditSection(section) {
    setEditingSection(section)
    setNewSectionName(section.nome)
    setNewSectionDescription(section.descricao || '')
    setShowSectionModal(true)
  }

  async function handleDeleteSection(idSecao) {
    const confirmed = await confirm({
      title: 'Remover seção',
      message: 'Tem certeza que deseja excluir esta seção e todos os seus exercícios? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'warning'
    })

    if (!confirmed) return

    try {
      await deletarSecao(idSecao)
      await carregarTreino()
    } catch (error) {
      console.error(error)
      alert({ title: 'Erro', message: 'Erro ao excluir seção.', type: 'error' })
    }
  }

  async function handleDeleteTreino() {
    const confirmed = await confirm({
      title: 'Excluir treino',
      message: 'Tem certeza que deseja excluir este treino permanentemente? Esta ação não pode ser desfeita e afetará todos os agendamentos associados.',
      confirmText: 'Excluir permanentemente',
      cancelText: 'Cancelar',
      type: 'warning'
    })

    if (!confirmed || !id) return

    try {
      await deletarTreino(id)
      navigate('/treinos')
    } catch (error) {
      console.error(error)
      alert({ title: 'Erro', message: 'Erro ao excluir treino.', type: 'error' })
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
    <DashboardLayout loading={loading} loadingMessage="Carregando treino...">

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-sm text-primary font-semibold">
              Editar treinos
            </p>

            <h1 className="text-3xl font-bold mt-3">
              Personalize seu treino
            </h1>

            <p className="text-slate-600 mt-2">
              Ajuste seções e exercícios.
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              to="/treinos"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

          <div className="rounded-[2rem] bg-white p-8 shadow-sm border border-slate-200">

            <label className="text-sm font-semibold text-slate-700">
              Nome do treino
            </label>

            <input
              type="text"
              value={workoutName}
              onChange={(e) =>
                setWorkoutName(e.target.value)
              }
              className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
            />

            <label className="text-sm font-semibold text-slate-700 mt-6 block">
              Descrição do treino (opcional)
            </label>

            <textarea
              rows={4}
              value={workoutDescription}
              onChange={(e) =>
                setWorkoutDescription(e.target.value)
              }
              placeholder="Adicione uma descrição breve para seu treino"
              className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
            />

            <button
              onClick={handleSalvarTreino}
              disabled={saving}
              className="mt-6 rounded-2xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary-hover disabled:opacity-50"
            >

              {saving
                ? 'Salvando...'
                : 'Salvar treino'}

            </button>

          </div>

          <div className="rounded-[2rem] bg-white p-8 shadow-sm border border-slate-200">

            <p className="text-sm text-slate-600 uppercase tracking-[0.18em]">
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
              className="mt-6 inline-flex items-center justify-center rounded-3xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
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

      {showSectionModal && (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">

      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">

        <h2 className="text-2xl font-bold">
          {editingSection ? 'Editar seção' : 'Nova seção'}
        </h2>

        <p className="text-slate-600 mt-2">
          Configure o nome e descrição da seção.
        </p>

        <div className="mt-6">

          <label className="text-sm font-semibold text-slate-700">
            Nome da seção
          </label>

          <input
            type="text"
            value={newSectionName}
            onChange={(e) =>
              setNewSectionName(e.target.value)
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-primary"
          />

        </div>

        <div className="mt-5">

          <label className="text-sm font-semibold text-slate-700">
            Descrição
          </label>

          <textarea
            value={newSectionDescription}
            onChange={(e) =>
              setNewSectionDescription(e.target.value)
            }
            rows={4}
            placeholder="Descrição opcional..."
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-primary resize-none"
          />

        </div>

        <div className="mt-8 flex justify-end gap-3">

          <button
            onClick={() => {
              setShowSectionModal(false)
              setEditingSection(null)
            }}
            className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>

          <button
            onClick={handleSaveSection}
            className="rounded-2xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-hover"
          >
            {editingSection ? 'Atualizar seção' : 'Criar seção'}
          </button>

        </div>

      </div>

    </div>

  )}

    </DashboardLayout>

  )
}