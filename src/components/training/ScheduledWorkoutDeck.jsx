import { motion, useReducedMotion } from 'framer-motion'

import Button from '../ui/Button'
import WorkoutCard from './WorkoutCard'

const selectedDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
})

function formatSelectedDate(value, today) {
  if (value === today) return 'Hoje'

  const [year, month, day] = value.split('-').map(Number)
  return selectedDateFormatter.format(new Date(year, month - 1, day))
}

export default function ScheduledWorkoutDeck({
  appointments,
  activeIndex,
  selectedDate,
  today,
  removingId,
  onActiveIndexChange,
  onStart,
  onRemove,
  onBrowseWorkouts,
}) {
  const reduceMotion = useReducedMotion()
  const activeAppointment = appointments[activeIndex]
  const visibleLayers = appointments.slice(activeIndex + 1, activeIndex + 3)
  const selectedDateLabel = formatSelectedDate(selectedDate, today)

  if (!activeAppointment) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center dark:border-white/[0.1] dark:bg-[#080808] sm:px-10 sm:py-12">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary dark:bg-[#101010]">
          <i className="fa-regular fa-calendar-check text-lg" aria-hidden="true" />
        </div>
        <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-slate-900 dark:text-white">
          Seu dia está livre
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
          Não há treino agendado para {selectedDateLabel.toLowerCase()}. Seus treinos continuam disponíveis logo abaixo.
        </p>
        <button
          type="button"
          onClick={onBrowseWorkouts}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:hover:bg-[#101010] dark:focus-visible:ring-offset-black"
        >
          Ver treinos disponíveis
          <i className="fa-solid fa-arrow-down text-xs" aria-hidden="true" />
        </button>
      </div>
    )
  }

  const activeWorkout = activeAppointment.treino
  const canGoBack = activeIndex > 0
  const canGoForward = activeIndex < appointments.length - 1

  function handleDeckKeyDown(event) {
    if (event.key === 'ArrowLeft' && canGoBack) {
      event.preventDefault()
      onActiveIndexChange(activeIndex - 1)
    }

    if (event.key === 'ArrowRight' && canGoForward) {
      event.preventDefault()
      onActiveIndexChange(activeIndex + 1)
    }
  }

  function handleDragEnd(_, info) {
    const movedLeft = info.offset.x < -48 || info.velocity.x < -500
    const movedRight = info.offset.x > 48 || info.velocity.x > 500

    if (movedLeft && canGoForward) onActiveIndexChange(activeIndex + 1)
    if (movedRight && canGoBack) onActiveIndexChange(activeIndex - 1)
  }

  return (
    <div
      className="outline-none"
      role="region"
      aria-roledescription="carrossel"
      aria-label={`Treinos agendados para ${selectedDateLabel}`}
      tabIndex={0}
      onKeyDown={handleDeckKeyDown}
    >
      <p className="sr-only" aria-live="polite">
        Treino {activeIndex + 1} de {appointments.length}: {activeWorkout?.nome || 'Treino'}
      </p>

      <div className="relative pt-8 sm:pt-10">
        {[...visibleLayers].reverse().map((appointment, reverseIndex) => {
          const layerIndex = visibleLayers.length - reverseIndex
          const workout = appointment.treino

          return (
            <button
              key={appointment.id_agendamento}
              type="button"
              onClick={() => onActiveIndexChange(activeIndex + layerIndex)}
              aria-label={`Mostrar ${workout?.nome || 'próximo treino'}`}
              className="absolute inset-x-0 top-8 h-[18rem] rounded-[1.75rem] border border-primary/10 bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-white/[0.06] dark:bg-[#111] dark:focus-visible:ring-offset-black sm:top-10"
              style={{
                zIndex: 5 - layerIndex,
                transform: `translateY(${-layerIndex * 14}px) scale(${1 - layerIndex * 0.035})`,
                opacity: 1 - layerIndex * 0.18,
              }}
            >
              <span className="sr-only">{workout?.nome}</span>
            </button>
          )
        })}

        <motion.div
          key={activeAppointment.id_agendamento}
          className="relative z-10 cursor-grab touch-pan-y active:cursor-grabbing"
          drag={!reduceMotion && appointments.length > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
        >
          <WorkoutCard
            workout={activeWorkout}
            prominent
            eyebrow={`Agendado para ${selectedDateLabel}`}
            actions={(
              <>
                {appointments.length > 1 ? (
                  <span className="text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
                    {activeIndex + 1}/{appointments.length}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(activeAppointment)}
                  disabled={removingId === activeAppointment.id_agendamento}
                  aria-label={`Remover agendamento de ${activeWorkout?.nome || 'treino'}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                >
                  <i className={`fa-solid ${removingId === activeAppointment.id_agendamento ? 'fa-spinner fa-spin' : 'fa-trash-can'} text-sm`} aria-hidden="true" />
                </button>
              </>
            )}
            footer={(
              <Button
                className="min-h-12 w-full rounded-2xl text-base"
                onClick={() => onStart(activeAppointment)}
              >
                <i className="fa-solid fa-play text-xs text-white" aria-hidden="true" />
                Iniciar treino
              </Button>
            )}
          />
        </motion.div>
      </div>

      {appointments.length > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Deslize ou use as setas para navegar</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onActiveIndexChange(activeIndex - 1)}
              disabled={!canGoBack}
              aria-label="Treino anterior"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/[0.08] dark:text-slate-200"
            >
              <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onActiveIndexChange(activeIndex + 1)}
              disabled={!canGoForward}
              aria-label="Próximo treino"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/[0.08] dark:text-slate-200"
            >
              <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
