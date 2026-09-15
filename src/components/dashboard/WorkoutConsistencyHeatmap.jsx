import { useEffect, useMemo, useRef, useState } from 'react'

import Card from '../ui/Card'
import { buildExerciseHeatmap } from '../../utils/dashboardInsights'

const CELL_SIZE = 12
const CELL_GAP = 4
const CHART_PADDING = 8
const RANGE_OPTIONS = [
  { value: 'current-year', label: 'Ano atual' },
  { value: 'rolling-year', label: 'Últimos 12 meses' },
]

function intensityLevel(count) {
  if (count >= 8) return 4
  if (count >= 5) return 3
  if (count >= 3) return 2
  if (count >= 1) return 1
  return 0
}

function cellClass(day) {
  if (day.isOutsideRange) return 'border-transparent bg-transparent opacity-0'

  return [
    'border-slate-200 bg-slate-100 dark:border-white/[0.06] dark:bg-white/[0.06]',
    'border-blue-200 bg-blue-200 dark:border-blue-400 dark:bg-blue-400',
    'border-blue-400 bg-blue-400 dark:border-blue-600 dark:bg-blue-600',
    'border-blue-600 bg-blue-600 dark:border-blue-800 dark:bg-blue-800',
    'border-blue-800 bg-blue-800 dark:border-blue-950 dark:bg-blue-950',
  ][intensityLevel(day.count)]
}

function activityDate(day) {
  return day.date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function activityLabel(day) {
  const date = activityDate(day)
  if (day.isFuture) return `${date}, data futura`
  return `${date}, ${day.count} ${day.count === 1 ? 'exercício concluído' : 'exercícios concluídos'}`
}

export default function WorkoutConsistencyHeatmap({ history }) {
  const [range, setRange] = useState('current-year')
  const heatmap = useMemo(() => buildExerciseHeatmap(history, new Date(), { range }), [history, range])
  const lastAvailableIndex = (() => {
    for (let index = heatmap.days.length - 1; index >= 0; index -= 1) {
      if (!heatmap.days[index]?.isOutsideRange) return index
    }
    return -1
  })()
  const [activeIndex, setActiveIndex] = useState(Math.max(lastAvailableIndex, 0))
  const cellRefs = useRef([])
  const railRef = useRef(null)
  const activeDay = heatmap.days[activeIndex]?.isOutsideRange
    ? heatmap.days[lastAvailableIndex]
    : heatmap.days[activeIndex]
  const chartWidth = heatmap.weeks.length * (CELL_SIZE + CELL_GAP) - CELL_GAP
  const rangeTotalLabel = range === 'current-year' ? 'Total no ano' : 'Total em 12 meses'

  useEffect(() => {
    setActiveIndex(Math.max(lastAvailableIndex, 0))
    const rail = railRef.current
    if (!rail || rail.scrollWidth <= rail.clientWidth) return
    rail.scrollLeft = rail.scrollWidth - rail.clientWidth
  }, [lastAvailableIndex, range])

  const moveFocus = (nextIndex) => {
    let bounded = Math.max(0, Math.min(lastAvailableIndex, nextIndex))
    while (bounded < lastAvailableIndex && heatmap.days[bounded]?.isOutsideRange) bounded += 1
    setActiveIndex(bounded)
    const cell = cellRefs.current[bounded]
    const rail = railRef.current
    cell?.focus({ preventScroll: true })
    if (!cell || !rail) return

    const cellRect = cell.getBoundingClientRect()
    const railRect = rail.getBoundingClientRect()
    const leftEdge = railRect.left + CHART_PADDING
    const rightEdge = railRect.right - CHART_PADDING
    const offset = cellRect.left < leftEdge
      ? cellRect.left - leftEdge
      : cellRect.right > rightEdge
        ? cellRect.right - rightEdge
        : 0

    if (offset) rail.scrollTo({ left: rail.scrollLeft + offset, behavior: 'instant' })
  }

  const handleKeyDown = (event, index) => {
    const moves = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
    }
    if (event.key in moves) {
      event.preventDefault()
      moveFocus(index + moves[event.key])
    } else if (event.key === 'Home') {
      event.preventDefault()
      moveFocus(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      moveFocus(lastAvailableIndex)
    }
  }

  return (
    <Card hover={false} className="dashboard-surface min-w-0 w-full max-w-full border-slate-200 bg-white p-6 dark:border-white/[0.08] dark:bg-[#090909] sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {range === 'current-year' ? 'Ano atual' : 'Últimos 12 meses'}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-white">
            Exercícios ao longo do ano
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Cada quadrado representa um dia. Quanto mais intenso o azul, mais exercícios foram concluídos no dia selecionado.
          </p>
        </div>

        <div className="flex min-w-0 w-full flex-col gap-3 xl:w-[31rem] xl:items-end">
          <div className="inline-flex w-fit max-w-full rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]" aria-label="Período do calendário">
            {RANGE_OPTIONS.map((option) => {
              const selected = option.value === range
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setRange(option.value)}
                  className={`min-h-11 min-w-0 rounded-lg px-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#090909] ${
                    selected
                      ? 'bg-white text-primary shadow-sm dark:bg-white/[0.1] dark:text-blue-300'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2">
            <div className="flex min-h-24 flex-col justify-between rounded-2xl border border-primary/15 bg-primary/[0.055] px-4 py-3.5 dark:border-primary/25 dark:bg-primary/[0.09]">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-primary dark:text-blue-300">
                {rangeTotalLabel}
              </p>
              <div className="mt-3 flex items-end gap-2">
                <strong className="text-3xl font-semibold leading-none tracking-[-0.05em] text-slate-950 dark:text-white">
                  {heatmap.totalExercises}
                </strong>
                <span className="pb-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {heatmap.totalExercises === 1 ? 'exercício' : 'exercícios'}
                </span>
              </div>
            </div>

            <div
              className="flex min-h-24 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-white/[0.08] dark:bg-white/[0.04]"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Dia selecionado
              </p>
              {activeDay ? (
                <div className="mt-2">
                  <time
                    dateTime={activeDay.key}
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    {activityDate(activeDay)}
                  </time>
                  <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                    {activeDay.count} {activeDay.count === 1 ? 'exercício concluído' : 'exercícios concluídos'}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  Nenhuma atividade registrada
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div ref={railRef} className="training-rail mt-8 min-w-0 w-full max-w-full overflow-x-auto pb-3" tabIndex="-1">
        <div className="w-max p-2" style={{ minWidth: `${chartWidth + 36 + CHART_PADDING * 2}px` }}>
          <div
            className="ml-9 grid"
            style={{ gridTemplateColumns: `repeat(${heatmap.weeks.length}, ${CELL_SIZE}px)`, gap: `${CELL_GAP}px` }}
            aria-hidden="true"
          >
            {heatmap.monthLabels.map((label, index) => (
              <span key={`${label}-${index}`} className="h-5 whitespace-nowrap text-[10px] font-medium capitalize text-slate-500 dark:text-slate-400">
                {label}
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-start gap-3">
            <div className="grid h-[108px] w-6 shrink-0 grid-rows-7 gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400" aria-hidden="true">
              <span />
              <span>seg</span>
              <span />
              <span>qua</span>
              <span />
              <span>sex</span>
              <span />
            </div>
            <div
              role="grid"
              aria-label={`${range === 'current-year' ? 'Exercícios no ano atual' : 'Exercícios nos últimos 12 meses'}. Use as setas para navegar pelos dias.`}
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${heatmap.weeks.length}, ${CELL_SIZE}px)`,
                gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                gridAutoFlow: 'column',
                gap: `${CELL_GAP}px`,
              }}
            >
              {heatmap.days.map((day, index) => (
                <button
                  key={day.key}
                  ref={(node) => { cellRefs.current[index] = node }}
                  type="button"
                  role="gridcell"
                  tabIndex={index === activeIndex ? 0 : -1}
                  disabled={day.isOutsideRange}
                  aria-label={activityLabel(day)}
                  aria-current={day.isToday ? 'date' : undefined}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => setActiveIndex(index)}
                  onMouseMove={() => !day.isOutsideRange && setActiveIndex(index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`rounded-[3px] border transition-colors duration-200 focus-visible:z-10 focus-visible:outline-none ${cellClass(day)} ${
                    index === activeIndex
                      ? 'z-10 ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-[#090909]'
                      : day.isToday
                        ? 'ring-1 ring-slate-700 ring-offset-1 dark:ring-white'
                        : ''
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5 dark:border-white/[0.06]">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="sm:hidden">Deslize para ver outros meses e toque em um dia.</span>
          <span className="hidden sm:inline">Navegue com as setas para consultar cada dia.</span>
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" aria-label="Legenda de intensidade de exercícios">
          <span>Menos</span>
          <span className="h-3 w-3 rounded-[3px] border border-slate-200 bg-slate-100 dark:border-white/[0.06] dark:bg-white/[0.06]" />
          <span className="h-3 w-3 rounded-[3px] border border-blue-200 bg-blue-200 dark:border-blue-400 dark:bg-blue-400" />
          <span className="h-3 w-3 rounded-[3px] border border-blue-400 bg-blue-400 dark:border-blue-600 dark:bg-blue-600" />
          <span className="h-3 w-3 rounded-[3px] border border-blue-600 bg-blue-600 dark:border-blue-800 dark:bg-blue-800" />
          <span className="h-3 w-3 rounded-[3px] border border-blue-800 bg-blue-800 dark:border-blue-950 dark:bg-blue-950" />
          <span>Mais</span>
        </div>
      </div>
    </Card>
  )
}
