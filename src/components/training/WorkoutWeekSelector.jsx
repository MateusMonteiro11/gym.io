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
  const canGoForward = weekStart < maxWeekStart

  return (
    <div className="border-b border-slate-200/80 pb-6 dark:border-white/[0.07]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
            Sua semana
          </p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
            {capitalize(monthFormatter.format(selectedDateValue))}
          </p>
        </div>

        <div className="flex items-center gap-2" aria-label="Navegar entre semanas">
          <button
            type="button"
            onClick={() => onWeekChange(addDaysKey(weekStart, -7))}
            disabled={!canGoBack}
            aria-label="Semana anterior"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors duration-200 hover:border-primary/30 hover:bg-primary-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/[0.08] dark:text-slate-200 dark:hover:bg-[#111] dark:focus-visible:ring-offset-black"
          >
            <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(addDaysKey(weekStart, 7))}
            disabled={!canGoForward}
            aria-label="Próxima semana"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors duration-200 hover:border-primary/30 hover:bg-primary-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/[0.08] dark:text-slate-200 dark:hover:bg-[#111] dark:focus-visible:ring-offset-black"
          >
            <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="training-rail -mx-6 overflow-x-auto sm:mx-0 sm:overflow-visible">
        <div className="grid min-w-[19.25rem] grid-cols-7 gap-0 sm:min-w-0 sm:gap-2" role="group" aria-label="Dias da semana">
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
                className={`relative flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 transition-[background-color,color,transform] duration-200 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black sm:min-h-[5.25rem] ${
                  isSelected
                    ? 'bg-primary text-white shadow-[0_12px_30px_rgba(20,87,247,0.24)]'
                    : isPast
                      ? 'cursor-not-allowed text-slate-300 dark:text-slate-700'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#101010]'
                }`}
              >
                <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.08em] ${isSelected ? 'text-white/75' : ''}`}>
                  {weekdayFormatter.format(date).replace('.', '')}
                </span>
                <span className="mt-1 text-lg font-semibold leading-none sm:text-xl">{date.getDate()}</span>
                <span
                  aria-hidden="true"
                  className={`mt-2 h-1.5 w-1.5 rounded-full ${
                    hasAppointment
                      ? isSelected
                        ? 'bg-[#fff]'
                        : 'bg-primary'
                      : isToday && !isSelected
                        ? 'bg-slate-300 dark:bg-slate-600'
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
