import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AgendarTreinoModal from '../components/AgendarTreinoModal'
import PageLoadingBoundary from '../components/ui/PageLoadingBoundary'
import PageHeader from '../components/ui/PageHeader'
import ContentEntrance from '../components/ui/ContentEntrance'
import Banner from '../components/ui/Banner'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ModalHeader from '../components/ui/ModalHeader'
import Input, { Label } from '../components/ui/Input'
import { useUi } from '../contexts/UiContext'
import { ui } from '../styles/theme'
import { layout } from '../styles/layout'

import { useTreino } from '../hooks/useTreino'
import { criarTreino, deletarTreino } from '../services/treinos/treinosService'
import {
  getSchedulingErrorMessage,
  getUserFriendlyErrorMessage,
  logError,
} from '../utils/errorMessages'
import { validateScheduleDate } from '../utils/dateUtils'
import { criarSecao } from '../services/treinos/secoesService'
import { adicionarExercicio } from '../services/treinos/treinosExerciciosService'
import { listarExercicios } from '../services/exercicios/exerciciosService'
import { criarAgendamento } from '../services/agendamentos/agendamentosService'
import { useAuth } from '../hooks/useAuth'
import ActionLoading from '../components/ui/ActionLoading'

const MAX_WORKOUT_NAME_LENGTH = 120
const MAX_WORKOUT_DESCRIPTION_LENGTH = 500
const MAX_SECTION_NAME_LENGTH = 100
const MAX_SECTION_DESCRIPTION_LENGTH = 500

function normalizeTextInput(value, maxLength) {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function countExercises(workout) {
  return (
    workout?.secoes_treino?.reduce(
      (acc, secao) => acc + (secao?.treinos_exercicios?.length || 0),
      0
    ) ?? 0
  )
}

export default function Treinos() {
  const navigate = useNavigate()
  const { alert, notify, confirm } = useUi()
  const { usuario } = useAuth()
  const { treinosSistema, meusTreinos, loading } = useTreino()
  const [meusTreinosLocal, setMeusTreinosLocal] = useState([])

  const [modalAgendamentoOpen, setModalAgendamentoOpen] = useState(false)
  const [treinoSelecionado, setTreinoSelecionado] = useState(null)
  const [modalCriarTreinoOpen, setModalCriarTreinoOpen] = useState(false)

  function handleCriarTreino() {
    setModalCriarTreinoOpen(true)
  }

  function handleAgendarTreino(treino) {
    setTreinoSelecionado(treino)
    setModalAgendamentoOpen(true)
  }

  async function handleDeletarTreino(treino) {
    if (!treino?.id_treino) return

    const confirmed = await confirm({
      title: 'Excluir treino',
      message: 'Esta ação é permanente. Tem certeza que deseja excluir este treino?',
      confirmLabel: 'Excluir treino',
      variant: 'danger',
    })

    if (!confirmed) return

    try {
      await deletarTreino(treino.id_treino)
      setMeusTreinosLocal((current) => current.filter((item) => item.id_treino !== treino.id_treino))
      notify({
        title: 'Treino excluído',
        message: 'O treino foi removido com sucesso.',
        type: 'success',
      })
    } catch (error) {
      logError(error, '[Treinos] Failed to delete workout')
      notify({
        title: 'Erro ao excluir treino',
        message: getUserFriendlyErrorMessage(error, 'Não foi possível excluir este treino.'),
        type: 'error',
      })
    }
  }

  async function handleConfirmarAgendamento(dados) {
    if (!usuario?.id || !treinoSelecionado?.id_treino) return

    const dateValidation = validateScheduleDate(dados?.dataAgendada)
    if (!dateValidation.isValid) {
      alert({
        title: 'Revise a data',
        message: dateValidation.message,
        type: 'warning',
      })
      return
    }

    try {
      await criarAgendamento({
        idUsuario: usuario.id,
        idTreino: treinoSelecionado.id_treino,
        dataAgendada: dados.dataAgendada,
      })
      setModalAgendamentoOpen(false)
      setTreinoSelecionado(null)
      notify({
        title: 'Treino agendado',
        message: `${treinoSelecionado.nome} foi adicionado à sua agenda.`,
        type: 'success',
      })
    } catch (error) {
      logError(error, '[Treinos] Failed to schedule workout')
      notify({
        title: 'Não foi possível agendar',
        message: getSchedulingErrorMessage(error),
        type: 'error',
      })
    }
  }

  useEffect(() => {
    setMeusTreinosLocal(meusTreinos)
  }, [meusTreinos])

  return (
    <PageLoadingBoundary loading={loading} loadingMessage="Carregando treinos...">
      <ContentEntrance>
      <PageHeader title="Treinos" subtitle="Gerencie, agende e personalize seus treinos" />
      </ContentEntrance>

      <ContentEntrance index={1}>
      <Banner
        variant="primary"
        icon="fa-dumbbell"
        title="Monte seu treino ideal"
        description="Crie seções, adicione exercícios e agende para treinar no dia certo."
        action={
          <Button onClick={handleCriarTreino} className="shrink-0">
            <i className="fa-solid fa-plus" /> Novo treino
          </Button>
        }
      />

      </ContentEntrance>
      <ContentEntrance as="section" index={2} className="mb-12">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-selection text-app-accent">
            <i className="fa-solid fa-layer-group" />
          </span>
          <div>
            <h2 className={ui.sectionTitle}>Treinos do sistema</h2>
            <p className={ui.sectionSubtitle}>Templates prontos para começar rápido</p>
          </div>
        </div>
        <div className={layout.workoutsGrid}>
          {treinosSistema.map((treino) => (
            <WorkoutLibraryCard
              key={treino.id_treino}
              workout={treino}
              viewPath={`/treinos/visualizar/${treino.id_treino}`}
              isSystem
              onAgendar={handleAgendarTreino}
            />
          ))}
        </div>
      </ContentEntrance>

      <ContentEntrance as="section" index={3}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-muted text-app-secondary">
              <i className="fa-solid fa-user-pen" />
            </span>
            <div>
              <h2 className={ui.sectionTitle}>Meus treinos</h2>
              <p className={ui.sectionSubtitle}>
                {meusTreinosLocal.length} treino(s) personalizado(s)
              </p>
            </div>
          </div>
          <Button onClick={handleCriarTreino} variant="secondary">
            <i className="fa-solid fa-plus" /> Criar treino
          </Button>
        </div>

        {meusTreinosLocal.length === 0 ? (
          <Card className={`${ui.cardPadding} text-center`}>
            <div className={`${ui.emptyIcon}  `}>
              <i className="fa-solid fa-folder-open" />
            </div>
            <p className="font-semibold text-app-ink">Nenhum treino personalizado ainda</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-app-secondary">
              Crie seu primeiro treino ou duplique um template do sistema.
            </p>
            <Button className="mt-6" onClick={handleCriarTreino}>
              Criar meu primeiro treino
            </Button>
          </Card>
        ) : (
          <div className={layout.workoutsGrid}>
            {meusTreinosLocal.map((treino) => (
              <WorkoutLibraryCard
                key={treino.id_treino}
                workout={treino}
                showActions
                viewPath={`/treinos/visualizar/${treino.id_treino}`}
                editPath={`/treinos/editar/${treino.id_treino}`}
                onAgendar={handleAgendarTreino}
                onDelete={handleDeletarTreino}
              />
            ))}
          </div>
        )}
      </ContentEntrance>

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
        onCreated={(workout) => setMeusTreinosLocal((current) => [workout, ...current])}
        usuario={usuario}
      />
    </PageLoadingBoundary>
  )
}

function ExerciseSearchSelector({ exercises, searchState, onSearchChange, onSelectExercise }) {
  const [isOpen, setIsOpen] = useState(false)

  const filteredExercises = exercises.filter((exercise) =>
    exercise.nome.toLowerCase().includes(searchState.toLowerCase())
  )

  return (
    <div className="relative flex-1">
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar exercício por nome..."
          value={searchState}
          onChange={(e) => {
            onSearchChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full rounded-xl border border-app-line bg-app-surface px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-app-accent"
        />
        {searchState && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-secondary hover:text-app-secondary"
          >
            <i className="fa-solid fa-times text-sm" />
          </button>
        )}
      </div>

      {isOpen && searchState && (
        <div className="absolute top-full left-0 right-0 z-10 mt-2 max-h-72 overflow-y-auto rounded-xl border border-app-line bg-app-surface shadow-lg">
          {filteredExercises.length > 0 ? (
            <div className="p-2">
              {filteredExercises.map((exercise) => (
                <button
                  key={exercise.id_exercicio}
                  type="button"
                  onClick={() => {
                    onSelectExercise(exercise.id_exercicio)
                    setIsOpen(false)
                  }}
                  className="mb-1 w-full rounded-lg px-3 py-2.5 text-left text-app-ink transition-colors duration-150 hover:bg-app-selection last:mb-0"
                >
                  <p className="font-medium text-sm">{exercise.nome}</p>
                  {exercise.grupo_muscular && (
                    <p className="text-xs text-app-secondary">{exercise.grupo_muscular}</p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-app-secondary">Nenhum exercício encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WorkoutLibraryCard({
  workout,
  showActions = false,
  isSystem = false,
  viewPath,
  editPath,
  onAgendar,
  onDelete,
}) {
  const navigate = useNavigate()
  const exerciseCount = countExercises(workout)
  const sectionCount = workout?.secoes_treino?.length ?? 0
  const typeLabel = isSystem ? 'Sistema' : 'Personalizado'

  return (
    <article className="workout-library-card group relative isolate flex min-h-[24.5rem] pt-2">
      <span
        aria-hidden="true"
        className={`workout-library-card__layer pointer-events-none absolute inset-x-3 bottom-0 top-0 rounded-[1.75rem] ${
          isSystem
            ? 'bg-app-action/15'
            : 'bg-app-muted'
        }`}
      />

      <div className="workout-library-card__surface relative z-10 flex min-h-96 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-app-line/80 bg-app-surface">
        <div className="workout-library-card__header flex shrink-0 gap-2 px-4 py-4">
          <span
            className={`inline-flex min-h-7 items-center rounded-full border px-2 text-[0.625rem] font-semibold uppercase tracking-[0.08em] ${
              isSystem
                ? 'border-app-accent/20 bg-app-action/10 text-app-accent'
                : 'border-app-line bg-app-muted text-app-ink'
            }`}
          >
            {typeLabel}
          </span>

          {showActions && editPath && !isSystem ? (
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={`Ações de ${workout.nome}`}
            >
              <button
                type="button"
                onClick={() => navigate(editPath)}
                title="Editar treino"
                aria-label={`Editar ${workout.nome}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-app-line text-app-secondary hover:border-app-accent/30 hover:bg-app-action/10 hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 ring-offset-app-canvas"
              >
                <i className="fa-solid fa-pen text-xs" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(workout)}
                title="Excluir treino"
                aria-label={`Excluir ${workout.nome}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-app-danger text-app-danger hover:bg-app-danger-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-danger focus-visible:ring-offset-2 ring-offset-app-canvas"
              >
                <i className="fa-solid fa-trash-can text-xs" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:pb-6">
          <span className="workout-library-card__accent mb-5 h-1 w-10 rounded-full bg-app-action" aria-hidden="true" />

          <h3 className="line-clamp-2 text-[1.65rem] font-semibold leading-[1.05] tracking-[-0.035em] text-app-ink sm:text-[1.8rem]">
            {workout.nome}
          </h3>
          <p className="mt-4 line-clamp-2 min-h-12 text-sm leading-6 text-app-secondary">
            {workout.descricao || 'Sem descrição'}
          </p>

          <p className="mt-6 text-[0.6875rem] font-medium text-app-secondary">
            {sectionCount} {sectionCount === 1 ? 'seção' : 'seções'}
            <span className="mx-2 text-app-secondary" aria-hidden="true">/</span>
            {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'}
          </p>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-8">
            <Link
              to={viewPath}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-app-ink hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 ring-offset-app-canvas"
            >
              Visualizar
              <i className="workout-library-card__arrow fa-solid fa-arrow-right text-xs text-app-accent" aria-hidden="true" />
            </Link>

            {onAgendar ? (
              <button
                type="button"
                onClick={() => onAgendar(workout)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-app-action px-3 py-2 text-sm font-semibold text-white hover:bg-app-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 ring-offset-app-canvas"
              >
                <i className="fa-solid fa-calendar-plus text-xs" aria-hidden="true" />
                Agendar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

function ModalCriarTreino({ open, onClose, onCreated, usuario }) {
  const { alert, notify, confirm } = useUi()
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
    if (open) carregarExercicios()
  }, [open])

  async function carregarExercicios() {
    try {
      const exerciciosData = await listarExercicios()
      setExercicios(Array.isArray(exerciciosData) ? exerciciosData : [])
    } catch (error) {
      console.error(error)
      alert({
        title: 'Erro ao carregar',
        message: 'Não foi possível carregar a lista de exercícios.',
        type: 'error',
      })
    }
  }

  async function handleSaveSection() {
    const normalizedSectionName = normalizeTextInput(newSectionName, MAX_SECTION_NAME_LENGTH)
    const normalizedSectionDescription = normalizeTextInput(
      newSectionDescription,
      MAX_SECTION_DESCRIPTION_LENGTH
    )

    if (!normalizedSectionName) {
      alert({
        title: 'Nome obrigatório',
        message: 'Informe um nome para identificar esta seção.',
        type: 'warning',
      })
      return
    }

    if (editingSection) {
      setSections(
        sections.map((s) =>
          s.id_secao === editingSection.id_secao
            ? { ...s, nome: normalizedSectionName, descricao: normalizedSectionDescription }
            : s
        )
      )
    } else {
      setSections([
        ...sections,
        {
          id_secao: Date.now(),
          nome: normalizedSectionName,
          descricao: normalizedSectionDescription,
          treinos_exercicios: [],
        },
      ])
    }

    setShowSectionModal(false)
    setEditingSection(null)
    setNewSectionName('')
    setNewSectionDescription('')
  }

  function handleAddExercise(idSecao, idExercicio) {
    const exercise = exercicios.find((e) => e.id_exercicio === idExercicio)
    if (!exercise) return

    setSections(
      sections.map((s) => {
        if (s.id_secao === idSecao) {
          return {
            ...s,
            treinos_exercicios: [
              ...s.treinos_exercicios,
              {
                id_treino_exercicio: Date.now(),
                exercicios: exercise,
                series: 4,
                repeticoes: 12,
              },
            ],
          }
        }
        return s
      })
    )
  }

  async function handleRemoveExercise(idTreinoExercicio) {
    const ok = await confirm({
      title: 'Remover exercício',
      message: 'Deseja remover este exercício da seção?',
      confirmLabel: 'Remover',
      variant: 'danger',
    })
    if (!ok) return

    setSections(
      sections.map((s) => ({
        ...s,
        treinos_exercicios: s.treinos_exercicios.filter(
          (e) => e.id_treino_exercicio !== idTreinoExercicio
        ),
      }))
    )
  }

  function handleEditSection(section) {
    setEditingSection(section)
    setNewSectionName(section.nome)
    setNewSectionDescription(section.descricao || '')
    setShowSectionModal(true)
  }

  async function handleDeleteSection(idSecao) {
    const ok = await confirm({
      title: 'Excluir seção',
      message: 'Todos os exercícios desta seção serão removidos. Continuar?',
      confirmLabel: 'Excluir seção',
      variant: 'danger',
    })
    if (!ok) return
    setSections(sections.filter((s) => s.id_secao !== idSecao))
  }

  async function handleSalvarTreino() {
    try {
      setSaving(true)
      const normalizedWorkoutName = normalizeTextInput(workoutName, MAX_WORKOUT_NAME_LENGTH)
      const normalizedWorkoutDescription = normalizeTextInput(
        workoutDescription,
        MAX_WORKOUT_DESCRIPTION_LENGTH
      )

      if (!normalizedWorkoutName) {
        alert({
          title: 'Nome obrigatório',
          message: 'Informe um nome para o treino antes de salvar.',
          type: 'warning',
        })
        return
      }

      const hasValidSections = sections.some(
        (section) => section.treinos_exercicios?.length > 0
      )
      if (!hasValidSections) {
        alert({
          title: 'Treino incompleto',
          message: 'Adicione pelo menos uma seção com um exercício antes de salvar.',
          type: 'warning',
        })
        return
      }

      const treino = await criarTreino({
        nome: normalizedWorkoutName,
        descricao: normalizedWorkoutDescription,
        publico: false,
        id_usuario: usuario.id,
      })

      const createdSections = []

      for (const [sectionIndex, section] of sections.entries()) {
        const secao = await criarSecao({
          id_treino: treino.id_treino,
          nome: section.nome,
          descricao: section.descricao,
          ordem: sectionIndex + 1,
        })

        const createdExercises = []

        for (const [exerciseIndex, exercise] of section.treinos_exercicios.entries()) {
          const createdExercise = await adicionarExercicio({
            id_treino: treino.id_treino,
            id_secao: secao.id_secao,
            id_exercicio: exercise.exercicios.id_exercicio,
            series: exercise.series,
            repeticoes: exercise.repeticoes,
            carga: 0,
            descanso_segundos: 60,
            ordem: exerciseIndex + 1,
          })
          createdExercises.push(createdExercise)
        }

        createdSections.push({ ...secao, treinos_exercicios: createdExercises })
      }

      onCreated?.({ ...treino, tipo: treino.tipo || 'usuario', secoes_treino: createdSections })
      notify({
        title: 'Treino criado',
        message: `"${normalizedWorkoutName}" foi salvo com sucesso.`,
        type: 'success',
      })
      onClose()
    } catch (error) {
      logError(error, '[Treinos] Failed to save workout')
      notify({
        title: 'Erro ao salvar',
        message: getUserFriendlyErrorMessage(error, 'Não foi possível criar o treino.'),
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} size="xl" className="p-0">
        <ModalHeader
          title="Criar novo treino"
          subtitle="Defina o treino, organize seções e adicione exercícios"
          onClose={onClose}
        />
        <div className="space-y-6 p-6 pt-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-app-line bg-app-muted p-6">
              <Label>Nome do treino</Label>
              <Input
                type="text"
                value={workoutName}
                maxLength={MAX_WORKOUT_NAME_LENGTH}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="mt-2 text-lg font-semibold"
              />
              <Label className="mt-4 block">Descrição (opcional)</Label>
              <textarea
                rows={3}
                value={workoutDescription}
                maxLength={MAX_WORKOUT_DESCRIPTION_LENGTH}
                onChange={(e) => setWorkoutDescription(e.target.value)}
                placeholder="Objetivo ou foco do treino..."
                className={`${ui.input} mt-2 resize-none`}
              />
              <Button className="mt-6 w-full" onClick={handleSalvarTreino} disabled={saving}>
                {saving ? (
                  <ActionLoading label="Salvando..." inverse />
                ) : (
                  <>
                    <i className="fa-solid fa-check" /> Criar treino
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-2xl border border-app-line bg-app-muted p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-secondary">Resumo</p>
              <p className="mt-3 text-3xl font-bold text-app-ink">{sections.length}</p>
              <p className="text-sm text-app-secondary">seções adicionadas</p>
              <Button
                variant="secondary"
                className="mt-6 w-full"
                onClick={() => {
                  setEditingSection(null)
                  setNewSectionName(`Seção ${sections.length + 1}`)
                  setNewSectionDescription('')
                  setShowSectionModal(true)
                }}
              >
                <i className="fa-solid fa-plus" /> Nova seção
              </Button>
            </div>
          </div>

          {sections.map((section) => (
            <div
              key={section.id_secao}
              className="rounded-2xl border border-app-line bg-app-surface p-5 shadow-sm dark:shadow-black/20"
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-app-ink">{section.nome}</h3>
                  <p className="mt-1 text-sm text-app-secondary">
                    {section.descricao || 'Sem descrição'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditSection(section)}
                    className={`${ui.btnGhost} text-sm  `}
                  >
                    <i className="fa-solid fa-pen" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(section.id_secao)}
                    className={`${ui.btnDanger} text-sm py-2 px-4`}
                  >
                    <i className="fa-solid fa-trash text-white" /> Excluir
                  </button>
                </div>
              </div>
              <ExerciseSearchSelector
                exercises={exercicios}
                searchState={section.searchState ?? ''}
                onSearchChange={(value) => {
                  setSections((current) =>
                    current.map((s) =>
                      s.id_secao === section.id_secao
                        ? { ...s, searchState: value }
                        : s
                    )
                  )
                }}
                onSelectExercise={(exerciseId) => {
                  handleAddExercise(section.id_secao, exerciseId)
                  setSections((current) =>
                    current.map((s) =>
                      s.id_secao === section.id_secao
                        ? { ...s, searchState: '' }
                        : s
                    )
                  )
                }}
              />
              <div className="space-y-2">
                {section.treinos_exercicios?.map((item, index) => (
                  <div
                    key={item.id_treino_exercicio}
                    className="flex items-center justify-between gap-3 rounded-xl bg-app-muted p-3"
                  >
                    <div>
                      <p className="font-medium text-app-ink">{item.exercicios?.nome}</p>
                      <p className="text-xs text-app-secondary">
                        {item.series || 4} séries • {item.repeticoes || 12} reps
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(item.id_treino_exercicio)}
                      className={`${ui.iconBtn} text-app-danger hover:bg-app-danger-muted  `}
                      aria-label="Remover exercício"
                    >
                      <i className="fa-solid fa-trash text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-app-line p-4 flex justify-end">
          <Button variant="secondary" onClick={onClose} className="">
            Fechar
          </Button>
        </div>
      </Modal>

      <Modal open={showSectionModal} onClose={() => setShowSectionModal(false)} size="md">
        <ModalHeader
          title={editingSection ? 'Editar seção' : 'Nova seção'}
          subtitle="Nome e descrição da seção do treino"
          onClose={() => {
            setShowSectionModal(false)
            setEditingSection(null)
          }}
        />
        <div className="space-y-4 p-6">
          <div>
            <Label>Nome da seção</Label>
            <Input
              value={newSectionName}
              maxLength={MAX_SECTION_NAME_LENGTH}
              onChange={(e) => setNewSectionName(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <textarea
              value={newSectionDescription}
              maxLength={MAX_SECTION_DESCRIPTION_LENGTH}
              onChange={(e) => setNewSectionDescription(e.target.value)}
              rows={3}
              placeholder="Opcional"
              className={`${ui.input} mt-2 resize-none`}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowSectionModal(false)
                setEditingSection(null)
              }}
            >
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSaveSection}>
              {editingSection ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
