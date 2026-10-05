import { useMemo } from 'react'

import { buildWeek, addDaysKey } from '../../utils/trainingDiscovery'

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : ''
}

export default function WorkoutWeekSelector({
  weekStart,
  selectedDate,
  today,
  appointmentDates,
  minWeekStart,
  maxWeekStart,
  onWeekChange,
  onSelectDate,
}) {
  const days = useMemo(() => buildWeek(weekStart), [weekStart])
  const selectedDateValue = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [selectedDate])
  const canGoBack = weekStart > minWeekStart
  const canGoForward = !maxWeekStart || weekStart < maxWeekStart

  return (
    <div className="border-b border-app-line/80 pb-10 sm:pb-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-5 sm:flex-nowrap">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-app-accent">
            Sua semana
          </p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-app-ink">
            {capitalize(monthFormatter.format(selectedDateValue))}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0" aria-label="Navegar entre semanas">
          <button
            type="button"
            onClick={() => onWeekChange(addDaysKey(weekStart, -7))}
            disabled={!canGoBack}
            aria-label="Semana anterior"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-app-line text-app-ink transition-colors duration-200 hover:border-app-accent/30 hover:bg-app-selection hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(addDaysKey(weekStart, 7))}
            disabled={!canGoForward}
            aria-label="Próxima semana"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-app-line text-app-ink transition-colors duration-200 hover:border-app-accent/30 hover:bg-app-selection hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="min-w-0 w-full overflow-visible">
        <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2" role="group" aria-label="Dias da semana">
          {days.map(({ date, key }) => {
            const isSelected = key === selectedDate
            const isToday = key === today
            const isPast = key < today
            const hasAppointment = appointmentDates.has(key)

            return (
              <button
                key={key}
                type="button"
                disabled={isPast}
                onClick={() => onSelectDate(key)}
                aria-label={capitalize(fullDateFormatter.format(date))}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                className={`relative flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 transition-[background-color,color,transform] duration-200 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2  sm:min-h-[5.25rem] ${
                  isSelected
                    ? 'bg-app-action text-white shadow-[0_12px_30px_rgba(20,87,247,0.24)]'
                    : isPast
                      ? 'cursor-not-allowed text-app-secondary dark:opacity-40'
                      : 'text-app-ink hover:bg-app-muted'
                }`}
              >
                <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.08em] ${isSelected ? 'text-white/90' : ''}`}>
                  {weekdayFormatter.format(date).replace('.', '')}
                </span>
                <span className="mt-1 text-lg font-semibold leading-none sm:text-xl">{date.getDate()}</span>
                <span
                  aria-hidden="true"
                  className={`mt-2 h-1.5 w-1.5 rounded-full ${
                    hasAppointment
                      ? isSelected
                        ? 'bg-white'
                        : 'bg-app-action'
                      : isToday && !isSelected
                        ? 'bg-app-muted'
                        : 'bg-transparent'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
