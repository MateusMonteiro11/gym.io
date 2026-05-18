import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AgendarTreinoModal from '../components/AgendarTreinoModal'
import DashboardLayout from '../layouts/DashboardLayout'
import PageHeader from '../components/ui/PageHeader'
import Banner from '../components/ui/Banner'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ModalHeader from '../components/ui/ModalHeader'
import Input, { Label } from '../components/ui/Input'
import { useUi } from '../contexts/UiContext'
import { ui } from '../styles/theme'

import { useTreino } from '../hooks/useTreino'
import { criarTreino } from '../services/treinos/treinosService'
import { criarSecao } from '../services/treinos/secoesService'
import { adicionarExercicio } from '../services/treinos/treinosExerciciosService'
import { listarExercicios } from '../services/exercicios/exerciciosService'
import { criarAgendamento } from '../services/agendamentos/agendamentosService'
import { useAuth } from '../hooks/useAuth'

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
  const { alert, notify } = useUi()
  const { usuario } = useAuth()
  const { treinosSistema, meusTreinos, loading } = useTreino()

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
      notify({
        title: 'Treino agendado',
        message: `${treinoSelecionado.nome} foi adicionado à sua agenda.`,
        type: 'success',
      })
    } catch (error) {
      console.error('Erro ao agendar treino:', error)
      alert({
        title: 'Não foi possível agendar',
        message: error?.message || 'Tente novamente em instantes.',
        type: 'error',
      })
    }
  }

  return (
    <DashboardLayout loading={loading} loadingMessage="Carregando treinos...">
      <PageHeader title="Treinos" subtitle="Gerencie, agende e personalize seus treinos" />

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

      <section className="mb-12">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <i className="fa-solid fa-layer-group" />
          </span>
          <div>
            <h2 className={ui.sectionTitle}>Treinos do sistema</h2>
            <p className={ui.sectionSubtitle}>Templates prontos para começar rápido</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {treinosSistema.map((treino) => (
            <WorkoutCard
              key={treino.id_treino}
              workout={treino}
              viewPath={`/treinos/visualizar/${treino.id_treino}`}
              isSystem
              onAgendar={handleAgendarTreino}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <i className="fa-solid fa-user-pen" />
            </span>
            <div>
              <h2 className={ui.sectionTitle}>Meus treinos</h2>
              <p className={ui.sectionSubtitle}>
                {meusTreinos.length} treino(s) personalizado(s)
              </p>
            </div>
          </div>
          <Button onClick={handleCriarTreino} variant="secondary">
            <i className="fa-solid fa-plus" /> Criar treino
          </Button>
        </div>

        {meusTreinos.length === 0 ? (
          <Card className={`${ui.cardPadding} text-center`}>
            <div className={ui.emptyIcon}>
              <i className="fa-solid fa-folder-open" />
            </div>
            <p className="font-semibold text-slate-900">Nenhum treino personalizado ainda</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
              Crie seu primeiro treino ou duplique um template do sistema.
            </p>
            <Button className="mt-6" onClick={handleCriarTreino}>
              Criar meu primeiro treino
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {meusTreinos.map((treino) => (
              <WorkoutCard
                key={treino.id_treino}
                workout={treino}
                showActions
                viewPath={`/treinos/visualizar/${treino.id_treino}`}
                editPath={`/treinos/editar/${treino.id_treino}`}
                onAgendar={handleAgendarTreino}
              />
            ))}
          </div>
        )}
      </section>

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
    </DashboardLayout>
  )
}

function WorkoutCard({
  workout,
  showActions = false,
  isSystem = false,
  viewPath,
  editPath,
  onAgendar,
}) {
  const exerciseCount = countExercises(workout)
  const sectionCount = workout?.secoes_treino?.length ?? 0

  return (
    <Card className="group overflow-hidden p-0">
      <div
        className={`h-2 ${isSystem ? 'bg-gradient-to-r from-primary to-blue-400' : 'bg-gradient-to-r from-slate-700 to-slate-500'}`}
      />
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg ${
              isSystem ? 'bg-primary-muted text-primary' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <i className={`fa-solid ${isSystem ? 'fa-bookmark' : 'fa-dumbbell'}`} />
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isSystem ? 'bg-primary-muted text-primary' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isSystem ? 'Sistema' : 'Personalizado'}
          </span>
        </div>

        <h3 className="font-semibold text-slate-900 line-clamp-1">{workout.nome}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
          {workout.descricao || 'Sem descrição'}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg border border-slate-100 bg-slate-50 py-2">
            <p className="font-semibold text-slate-900">{sectionCount}</p>
            <p className="text-slate-500">seções</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 py-2">
            <p className="font-semibold text-slate-900">{exerciseCount}</p>
            <p className="text-slate-500">exercícios</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Link
            to={viewPath}
            className={`${ui.btnSecondary} w-full text-sm py-2.5`}
          >
            <i className="fa-solid fa-eye" /> Visualizar
          </Link>
          {onAgendar && (
            <button
              type="button"
              onClick={() => onAgendar(workout)}
              className={`${ui.btnPrimary} w-full text-sm py-2.5`}
            >
              <i className="fa-solid fa-calendar-plus" /> Agendar
            </button>
          )}
          {showActions && editPath && !isSystem && (
            <Link
              to={editPath}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
            >
              <i className="fa-solid fa-pen" /> Editar
            </Link>
          )}
        </div>
      </div>
    </Card>
  )
}

function ModalCriarTreino({ open, onClose, usuario }) {
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
    if (!newSectionName.trim()) {
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
            ? { ...s, nome: newSectionName, descricao: newSectionDescription }
            : s
        )
      )
    } else {
      setSections([
        ...sections,
        {
          id_secao: Date.now(),
          nome: newSectionName,
          descricao: newSectionDescription,
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
        nome: workoutName,
        descricao: workoutDescription,
        publico: false,
        id_usuario: usuario.id,
      })

      for (const section of sections) {
        const secao = await criarSecao({
          id_treino: treino.id_treino,
          nome: section.nome,
          descricao: section.descricao,
          ordem: sections.indexOf(section) + 1,
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
            ordem: section.treinos_exercicios.indexOf(exercise) + 1,
          })
        }
      }

      notify({
        title: 'Treino criado',
        message: `"${workoutName}" foi salvo com sucesso.`,
        type: 'success',
      })
      onClose()
      window.location.reload()
    } catch (error) {
      console.error(error)
      alert({
        title: 'Erro ao salvar',
        message: 'Não foi possível criar o treino. Tente novamente.',
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
        <div className="space-y-6 p-6 pt-0 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <Label>Nome do treino</Label>
              <Input
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="mt-2 text-lg font-semibold"
              />
              <Label className="mt-4 block">Descrição (opcional)</Label>
              <textarea
                rows={3}
                value={workoutDescription}
                onChange={(e) => setWorkoutDescription(e.target.value)}
                placeholder="Objetivo ou foco do treino..."
                className={`${ui.input} mt-2 resize-none`}
              />
              <Button className="mt-6 w-full" onClick={handleSalvarTreino} disabled={saving}>
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check" /> Criar treino
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resumo</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{sections.length}</p>
              <p className="text-sm text-slate-600">seções adicionadas</p>
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
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{section.nome}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {section.descricao || 'Sem descrição'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditSection(section)}
                    className={`${ui.btnGhost} text-sm`}
                  >
                    <i className="fa-solid fa-pen" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(section.id_secao)}
                    className={`${ui.btnDanger} text-sm py-2 px-4`}
                  >
                    <i className="fa-solid fa-trash" /> Excluir
                  </button>
                </div>
              </div>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddExercise(section.id_secao, Number(e.target.value))
                    e.target.value = ''
                  }
                }}
                className={`${ui.input} mb-4`}
              >
                <option value="">Adicionar exercício...</option>
                {exercicios.map((exercise) => (
                  <option key={exercise.id_exercicio} value={exercise.id_exercicio}>
                    {exercise.nome}
                  </option>
                ))}
              </select>
              <div className="space-y-2">
                {section.treinos_exercicios?.map((item, index) => (
                  <div
                    key={item.id_treino_exercicio}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{item.exercicios?.nome}</p>
                      <p className="text-xs text-slate-600">
                        {item.series || 4} séries • {item.repeticoes || 12} reps
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(item.id_treino_exercicio)}
                      className={`${ui.iconBtn} text-danger hover:bg-danger-muted`}
                      aria-label="Remover exercício"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 p-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
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
        <div className="space-y-4 p-6 pt-0">
          <div>
            <Label>Nome da seção</Label>
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <textarea
              value={newSectionDescription}
              onChange={(e) => setNewSectionDescription(e.target.value)}
              rows={3}
              placeholder="Opcional — ex: Peito e tríceps"
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
