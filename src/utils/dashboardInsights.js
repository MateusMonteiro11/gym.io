import { parseDateTime } from './dateUtils.js'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function startOfWeek(value) {
  const date = toValidDate(value)
  if (!date) return null

  const result = startOfDay(date)
  result.setDate(result.getDate() - result.getDay())
  return result
}

export function endOfWeek(value) {
  const start = startOfWeek(value)
  if (!start) return null
  return endOfDay(addDays(start, 6))
}

export function addDays(value, amount) {
  const date = toValidDate(value)
  if (!date) return null
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

export function toLocalDateKey(value) {
  const date = toValidDate(value)
  if (!date) return ''

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function exerciseCount(item) {
  const count = Number(item?.total_exercicios ?? 0)
  if (!Number.isFinite(count)) return 0
  return Math.max(0, Math.trunc(count))
}

export function groupExercisesByDate(history = []) {
  return history.reduce((grouped, item) => {
    const key = toLocalDateKey(item?.data_execucao)
    if (!key) return grouped
    grouped[key] = (grouped[key] || 0) + exerciseCount(item)
    return grouped
  }, {})
}

export function sumExercisesBetween(history = [], start, end) {
  const startDate = toValidDate(start)
  const endDate = toValidDate(end)
  if (!startDate || !endDate) return 0

  return history.reduce((total, item) => {
    const date = toValidDate(item?.data_execucao)
    if (!date || date < startDate || date > endDate) return total
    return total + exerciseCount(item)
  }, 0)
}

export function getDashboardInsights(history = [], referenceDate = new Date()) {
  const reference = toValidDate(referenceDate) || new Date()
  const weekStart = startOfWeek(reference)
  const previousWeekStart = addDays(weekStart, -7)
  const previousWeekEnd = endOfDay(addDays(weekStart, -1))
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const monthEnd = endOfDay(new Date(reference.getFullYear(), reference.getMonth() + 1, 0))
  const previousMonthStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1)
  const previousMonthEnd = endOfDay(new Date(reference.getFullYear(), reference.getMonth(), 0))
  const quarterStartMonth = Math.floor(reference.getMonth() / 3) * 3
  const quarterStart = new Date(reference.getFullYear(), quarterStartMonth, 1)
  const quarterEnd = endOfDay(new Date(reference.getFullYear(), quarterStartMonth + 3, 0))
  const previousQuarterStart = new Date(reference.getFullYear(), quarterStartMonth - 3, 1)
  const previousQuarterEnd = endOfDay(new Date(reference.getFullYear(), quarterStartMonth, 0))
  const grouped = groupExercisesByDate(history)

  const currentWeekExercises = sumExercisesBetween(history, weekStart, endOfWeek(reference))
  const previousWeekExercises = sumExercisesBetween(history, previousWeekStart, previousWeekEnd)
  const currentMonthExercises = sumExercisesBetween(history, monthStart, monthEnd)
  const previousMonthExercises = sumExercisesBetween(history, previousMonthStart, previousMonthEnd)
  const currentQuarterExercises = sumExercisesBetween(history, quarterStart, quarterEnd)
  const previousQuarterExercises = sumExercisesBetween(history, previousQuarterStart, previousQuarterEnd)

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    const key = toLocalDateKey(date)
    return {
      date,
      key,
      count: grouped[key] || 0,
      isToday: key === toLocalDateKey(reference),
      isFuture: date > endOfDay(reference),
    }
  })

  return {
    currentWeekExercises,
    previousWeekExercises,
    weekDelta: currentWeekExercises - previousWeekExercises,
    currentMonthExercises,
    previousMonthExercises,
    monthDelta: currentMonthExercises - previousMonthExercises,
    currentQuarterExercises,
    previousQuarterExercises,
    quarterDelta: currentQuarterExercises - previousQuarterExercises,
    weekDays,
  }
}

export function buildExerciseHeatmap(
  history = [],
  referenceDate = new Date(),
  { year } = {}
) {
  const reference = toValidDate(referenceDate) || new Date()
  const selectedYear = Number.isInteger(year) && year >= 100 && year <= reference.getFullYear()
    ? year : reference.getFullYear()
  const { start: rangeStart, end: rangeEnd } = annualHistoryBounds(selectedYear)
  const grouped = groupExercisesByDate(history)
  const todayEnd = endOfDay(reference)
  const todayKey = toLocalDateKey(reference)
  const firstWeekStart = startOfWeek(rangeStart)
  const lastWeekStart = startOfWeek(addDays(rangeEnd, -1))
  const weekCount = calendarWeekDistance(firstWeekStart, lastWeekStart) + 1

  const weeks = Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekStart = addDays(firstWeekStart, weekIndex * 7)
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(weekStart, dayIndex)
      const key = toLocalDateKey(date)
      const isFuture = date > todayEnd
      const isOutsideRange = date < rangeStart || date >= rangeEnd

      return {
        date,
        key,
        count: isOutsideRange || isFuture ? 0 : grouped[key] || 0,
        isToday: key === todayKey,
        isFuture,
        isOutsideRange,
      }
    })

    return { start: weekStart, days }
  })

  const monthLabels = weeks.map((week, index) => {
    const monthStart = week.days.find((day) => !day.isOutsideRange && day.date.getDate() === 1)
    const firstRangeDay = index === 0
      ? week.days.find((day) => !day.isOutsideRange)
      : null
    const labelDate = monthStart?.date || firstRangeDay?.date
    return labelDate
      ? labelDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      : ''
  })
  const days = weeks.flatMap((week) => week.days)
  const totalExercises = days.reduce((total, day) => total + day.count, 0)

  return {
    year: selectedYear,
    weeks,
    days,
    monthLabels,
    startDate: rangeStart,
    endDate: addDays(rangeEnd, -1),
    totalExercises,
  }
}

export function annualHistoryBounds(year) {
  if (!Number.isInteger(year) || year < 100 || year > 9998) throw new RangeError('Ano inválido')
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) }
}

export function availableHistoryYears(firstActivity, referenceDate = new Date()) {
  const reference = toValidDate(referenceDate) || new Date()
  const currentYear = reference.getFullYear()
  const firstYear = Math.min(toValidDate(firstActivity)?.getFullYear() || currentYear, currentYear)
  return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index)
}

export function initialHeatmapDay(heatmap, referenceDate = new Date()) {
  const today = toLocalDateKey(referenceDate)
  if (heatmap.year === referenceDate.getFullYear()) return today
  return heatmap.days.findLast((day) => !day.isOutsideRange && !day.isFuture && day.count > 0)?.key
    || toLocalDateKey(heatmap.startDate)
}

function calendarWeekDistance(start, end) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endUtc - startUtc) / (7 * DAY_IN_MS))
}

function toValidDate(value) {
  const date = parseDateTime(value)
  if (!date || Number.isNaN(date.getTime())) return null
  return new Date(date)
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

export { DAY_IN_MS }
