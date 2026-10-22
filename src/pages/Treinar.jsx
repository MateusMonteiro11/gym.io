import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import PageLoadingBoundary from '../components/ui/PageLoadingBoundary'
import ContentEntrance from '../components/ui/ContentEntrance'
import PreWorkoutModal from '../components/PreWorkoutModal'
import ScheduledWorkoutDeck from '../components/training/ScheduledWorkoutDeck'
import WorkoutCatalog from '../components/training/WorkoutCatalog'
import WorkoutWeekSelector from '../components/training/WorkoutWeekSelector'

import { listarTreinos } from '../services/treinos/treinosService'

import { useAuth } from '../hooks/useAuth'
import { useUi } from '../contexts/UiContext'
import { useAgendamentos } from '../hooks/useAgendamentos'
import { getLocalDateInputValue, parseDateTime } from '../utils/dateUtils'
import { appointmentDateFromSearch } from '../utils/appointmentDate.js'
import {
  clampActiveIndex,
  getWeekStartKey,
  groupAppointmentsByDate,
} from '../utils/trainingDiscovery'

const agendaDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : ''
}

function formatAgendaTitle(dateKey, today) {
  if (dateKey === today) return 'Treinos de hoje'

  const date = parseDateTime(dateKey)
  return date ? capitalize(agendaDateFormatter.format(date)) : 'Agenda do dia'
}

export default function Treinar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { confirm, notify } = useUi()
  const { usuario } = useAuth()
  const {
    agendamentos,
    loading: loadingAgendamentos,
    excluirAgendamento,
  } = useAgendamentos()

  const [today] = useState(() => getLocalDateInputValue())
  const [selectedDate, setSelectedDate] = useState(() => appointmentDateFromSearch(location.search, today))
  const [weekStart, setWeekStart] = useState(() => getWeekStartKey(appointmentDateFromSearch(location.search, today)))
  const [activeIndex, setActiveIndex] = useState(0)
  const [treinos, setTreinos] = useState([])
  const [loadingTreinos, setLoadingTreinos] = useState(true)
  const [treinoSelecionado, setTreinoSelecionado] = useState(null)
  const [modalDescansoOpen, setModalDescansoOpen] = useState(false)
  const [descansoPadrao, setDescansoPadrao] = useState(60)
  const [removingId, setRemovingId] = useState(null)

  const minWeekStart = useMemo(() => getWeekStartKey(today), [today])
  const appointmentsByDate = useMemo(
    () => groupAppointmentsByDate(agendamentos),
    [agendamentos]
  )
  const appointmentDates = useMemo(
    () => new Set(Object.keys(appointmentsByDate)),
    [appointmentsByDate]
  )
  const selectedAppointments = appointmentsByDate[selectedDate] || []

  useEffect(() => {
    const date = appointmentDateFromSearch(location.search, today)
    setSelectedDate(date)
    setWeekStart(getWeekStartKey(date))
  }, [location.search, today])

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

  useEffect(() => {
    setActiveIndex((currentIndex) => clampActiveIndex(currentIndex, selectedAppointments.length))
  }, [selectedAppointments.length])

  function handleIniciarTreino(treino) {
    setTreinoSelecionado(treino)
    setModalDescansoOpen(true)
  }

  async function handleVisualizarTreino(treino, catalogSelection) {
    await navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: { ...location.state, catalogSelection },
    })
    navigate(`/treinos/visualizar/${treino.id_treino}`, {
      state: { from: '/treinar', catalogSelection },
    })
  }

  function handleIniciarAgendamento(agendamento) {
    const treino = agendamento?.treino
    if (!treino?.id_treino) return

    const descanso = agendamento.tempo_descanso ?? 60
    setDescansoPadrao(descanso)
    navigate(`/treinar/${treino.id_treino}`, {
      state: { descansoPadrao: descanso },
    })
  }

  async function handleRemoverAgendamento(agendamento) {
    const ok = await confirm({
      title: 'Excluir agendamento',
      message: `Deseja remover ${agendamento?.treino?.nome || 'este treino'} da sua agenda?`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    setRemovingId(agendamento.id_agendamento)

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
    } finally {
      setRemovingId(null)
    }
  }

  function handleWeekChange(nextWeekStart) {
    setWeekStart(nextWeekStart)
    setSelectedDate(nextWeekStart === minWeekStart ? today : nextWeekStart)
    setActiveIndex(0)
  }

  function handleSelectDate(dateKey) {
    setSelectedDate(dateKey)
    setActiveIndex(0)
  }

  function handleBrowseWorkouts() {
    const target = document.getElementById('treinos-disponiveis')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <PageLoadingBoundary
      loading={loadingTreinos || loadingAgendamentos}
      loadingMessage="Carregando treinos..."
    >
      <div className="mx-auto w-full max-w-5xl pb-10 sm:pb-16">
        <ContentEntrance as="header" className="mb-9 max-w-2xl sm:mb-12">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-app-accent">
            Seu próximo movimento
          </p>
          <h1 className="mt-3 text-[clamp(2.5rem,8vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-app-ink">
            Treinar
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-app-secondary sm:text-base">
            Encontre o treino certo para o dia e comece sem perder o ritmo.
          </p>
        </ContentEntrance>

        <ContentEntrance as="section" index={1} className="mx-auto max-w-3xl" aria-labelledby="agenda-title">
          <WorkoutWeekSelector
            weekStart={weekStart}
            selectedDate={selectedDate}
            today={today}
            appointmentDates={appointmentDates}
            minWeekStart={minWeekStart}
            onWeekChange={handleWeekChange}
            onSelectDate={handleSelectDate}
          />

          <div className="mt-8 sm:mt-10">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-app-accent">
                  Agenda do dia
                </p>
                <h2 id="agenda-title" className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-app-ink sm:text-3xl">
                  {formatAgendaTitle(selectedDate, today)}
                </h2>
              </div>
            </div>

            <ScheduledWorkoutDeck
              appointments={selectedAppointments}
              activeIndex={activeIndex}
              selectedDate={selectedDate}
              today={today}
              removingId={removingId}
              onActiveIndexChange={setActiveIndex}
              onStart={handleIniciarAgendamento}
              onRemove={handleRemoverAgendamento}
              onBrowseWorkouts={handleBrowseWorkouts}
            />
          </div>
        </ContentEntrance>

        <ContentEntrance index={2}>
        <WorkoutCatalog
          workouts={treinos}
          initialSelection={location.state?.catalogSelection}
          onViewWorkout={handleVisualizarTreino}
          onStart={handleIniciarTreino}
          onManageWorkouts={() => navigate('/treinos')}
        />

        </ContentEntrance>
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
                state: { descansoPadrao: descanso },
              })
            }
          }}
        />
      </div>
    </PageLoadingBoundary>
  )
}
