import { useEffect, useMemo, useRef, useState } from 'react'

import Card from '../ui/Card'
import HeatmapYearSelect from './HeatmapYearSelect.jsx'
import { buildExerciseHeatmap, availableHistoryYears, initialHeatmapDay, toLocalDateKey } from '../../utils/dashboardInsights.js'
import { createHistoryRepository } from '../../features/history/historyRepository.js'
import { useAnnualWorkoutHistory } from '../../features/history/useAnnualWorkoutHistory.js'
import { supabase } from '../../lib/supabase'

const defaultRepository = createHistoryRepository(supabase)

const CELL_SIZE = 12
const CELL_GAP = 4
const CHART_PADDING = 8

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
    'border-app-line bg-app-muted',
    'border-transparent bg-app-heat-1',
    'border-transparent bg-app-heat-2',
    'border-transparent bg-app-heat-3',
    'border-transparent bg-app-heat-4',
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

export default function WorkoutConsistencyHeatmap({ userId, repository = defaultRepository }) {
  const now = new Date()
  const todayKey = toLocalDateKey(now)
  const currentYear = now.getFullYear()
  const [year, setYear] = useState(currentYear)
  const resource = useAnnualWorkoutHistory(repository, userId, year, todayKey)
  const { activity, first } = resource
  const loading = activity.status === 'loading' || first.status === 'loading'
  const error = activity.status === 'error' || first.status === 'error'
  const years = availableHistoryYears(first.status === 'ready' ? first.data : null, now)
  const history = activity.status === 'ready' ? activity.data : []
  const heatmap = useMemo(() => buildExerciseHeatmap(history, new Date(), { year }), [history, year, todayKey])
  const lastAvailableIndex = (() => {
    for (let index = heatmap.days.length - 1; index >= 0; index -= 1) {
      if (!heatmap.days[index]?.isOutsideRange && !heatmap.days[index]?.isFuture) return index
    }
    return -1
  })()
  const [selectedDay, setSelectedDay] = useState(null)
  const selectionKey = `${year}:${resource.revision}`
  const defaultDay = initialHeatmapDay(heatmap, now)
  const activeKey = selectedDay?.selectionKey === selectionKey ? selectedDay.key : defaultDay
  const activeIndex = heatmap.days.findIndex((day) => day.key === activeKey)
  const activeDay = heatmap.days[activeIndex]
  const cellRefs = useRef([])
  const railRef = useRef(null)
  const chartWidth = heatmap.weeks.length * (CELL_SIZE + CELL_GAP) - CELL_GAP
  const selectDay = (key) => setSelectedDay({ selectionKey, key })

  useEffect(() => {
    const rail = railRef.current
    if (!rail || rail.scrollWidth <= rail.clientWidth) return
    const defaultIndex = heatmap.days.findIndex((day) => day.key === defaultDay)
    rail.scrollLeft = Math.max(0, 36 + Math.floor(defaultIndex / 7) * (CELL_SIZE + CELL_GAP) - rail.clientWidth + 40)
  }, [year, loading, defaultDay])

  const moveFocus = (nextIndex) => {
    let bounded = Math.max(0, Math.min(lastAvailableIndex, nextIndex))
    while (bounded < lastAvailableIndex && heatmap.days[bounded]?.isOutsideRange) bounded += 1
    selectDay(heatmap.days[bounded].key)
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
    <Card hover={false} className="dashboard-surface min-w-0 w-full max-w-full border-app-line bg-app-surface p-6 sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-accent">
            Ano {year}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-app-ink">
            Exercícios ao longo do ano
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-app-secondary">
            Cada quadrado representa um dia. Quanto mais intenso o azul, mais exercícios foram concluídos no dia selecionado.
          </p>
        </div>

        <div className="flex min-w-0 w-full flex-col gap-3 xl:w-[31rem] xl:items-end">
          <div className="flex w-full justify-end">
            <HeatmapYearSelect years={years} value={year} onChange={(next) => { setSelectedDay(null); setYear(next) }} />
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2">
            <div className="flex min-h-24 flex-col justify-between rounded-2xl border border-app-accent/15 bg-app-action/[0.055] px-4 py-3.5">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-app-accent">
                Total no ano
              </p>
              <div className="mt-3 flex items-end gap-2">
                <strong className="text-3xl font-semibold leading-none tracking-[-0.05em] text-app-ink">
                  {loading || error ? '—' : heatmap.totalExercises}
                </strong>
                <span className="pb-0.5 text-xs font-medium text-app-secondary">
                  {heatmap.totalExercises === 1 ? 'exercício' : 'exercícios'}
                </span>
              </div>
            </div>

            <div
              className="flex min-h-24 flex-col justify-between rounded-2xl border border-app-line bg-app-muted px-4 py-3.5"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-app-secondary">
                Dia selecionado
              </p>
              {activeDay ? (
                <div className="mt-2">
                  <time
                    dateTime={activeDay.key}
                    className="block text-xs font-medium text-app-secondary"
                  >
                    {activityDate(activeDay)}
                  </time>
                  <p className="mt-1 text-sm font-semibold text-app-ink">
                  {loading ? 'Carregando exercícios…' : error ? 'Dados indisponíveis' : `${activeDay.count} ${activeDay.count === 1 ? 'exercício concluído' : 'exercícios concluídos'}`}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm font-medium text-app-secondary">
                  Nenhuma atividade registrada
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-app-secondary">
        <p>Não foi possível carregar o histórico anual.</p>
        <button type="button" onClick={resource.retry} className="min-h-11 rounded-xl px-3 font-semibold text-app-accent hover:bg-app-selection">Tentar novamente</button>
      </div>}
      {loading && <p role="status" className="mt-6 text-sm text-app-secondary">Carregando histórico de {year}…</p>}
      {!loading && !error && heatmap.totalExercises === 0 && <p role="status" className="mt-6 text-sm text-app-secondary">Nenhum exercício concluído em {year}.</p>}

      <div ref={railRef} aria-busy={loading} className="training-rail mt-8 min-w-0 w-full max-w-full overflow-x-auto pb-3" tabIndex="-1">
        <div className="w-max p-2" style={{ minWidth: `${chartWidth + 36 + CHART_PADDING * 2}px` }}>
          <div
            className="ml-9 grid"
            style={{ gridTemplateColumns: `repeat(${heatmap.weeks.length}, ${CELL_SIZE}px)`, gap: `${CELL_GAP}px` }}
            aria-hidden="true"
          >
            {heatmap.monthLabels.map((label, index) => (
              <span key={`${label}-${index}`} className="h-5 whitespace-nowrap text-[10px] font-medium capitalize text-app-secondary">
                {label}
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-start gap-3">
            <div className="grid h-[108px] w-6 shrink-0 grid-rows-7 gap-1 text-[10px] font-medium text-app-secondary" aria-hidden="true">
              <span />
              <span>seg</span>
              <span />
              <span>qua</span>
              <span />
              <span>sex</span>
              <span />
            </div>
            <div
              role="group"
              aria-label={`Exercícios em ${year}. Use as setas para navegar pelos dias.`}
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
                  tabIndex={index === activeIndex ? 0 : -1}
                  disabled={day.isOutsideRange || day.isFuture || loading || error}
                  aria-hidden={day.isOutsideRange || undefined}
                  aria-label={activityLabel(day)}
                  aria-pressed={index === activeIndex}
                  aria-current={day.isToday ? 'date' : undefined}
                  onFocus={() => selectDay(day.key)}
                  onClick={() => selectDay(day.key)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`rounded-[3px] border transition-colors duration-200 focus-visible:z-10 focus-visible:outline-none ${cellClass(day)} ${day.isFuture ? 'opacity-40' : ''} ${
                    index === activeIndex
                      ? 'z-10 ring-2 ring-app-accent ring-offset-2 ring-offset-app-surface ring-offset-app-canvas'
                      : day.isToday
                        ? 'ring-1 ring-app-line ring-offset-1'
                        : ''
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-app-line pt-5">
        <p className="text-xs text-app-secondary">
          <span className="sm:hidden">Deslize para ver outros meses e toque em um dia.</span>
          <span className="hidden sm:inline">Navegue com as setas para consultar cada dia.</span>
        </p>
        <div className="flex items-center gap-2 text-xs text-app-secondary" aria-label="Legenda de intensidade de exercícios">
          <span>Menos</span>
          <span className="h-3 w-3 rounded-[3px] border border-app-line bg-app-muted" />
          <span className="h-3 w-3 rounded-[3px] bg-app-heat-1" />
          <span className="h-3 w-3 rounded-[3px] bg-app-heat-2" />
          <span className="h-3 w-3 rounded-[3px] bg-app-heat-3" />
          <span className="h-3 w-3 rounded-[3px] bg-app-heat-4" />
          <span>Mais</span>
        </div>
      </div>
    </Card>
  )
}
