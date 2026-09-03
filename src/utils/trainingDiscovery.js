import { getLocalDateInputValue, parseDateTime } from './dateUtils.js'

function asLocalDate(value) {
  const parsed = parseDateTime(value)
  if (!parsed || Number.isNaN(parsed.getTime())) return null

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

export function getWeekStart(value) {
  const date = asLocalDate(value)
  if (!date) return null

  date.setDate(date.getDate() - date.getDay())
  return date
}

export function getWeekStartKey(value) {
  const weekStart = getWeekStart(value)
  return weekStart ? getLocalDateInputValue(weekStart) : ''
}

export function addDaysKey(value, amount) {
  const date = asLocalDate(value)
  if (!date || !Number.isFinite(amount)) return ''

  date.setDate(date.getDate() + amount)
  return getLocalDateInputValue(date)
}

export function buildWeek(value) {
  const weekStart = getWeekStart(value)
  if (!weekStart) return []

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)

    return {
      date,
      key: getLocalDateInputValue(date),
    }
  })
}

export function groupAppointmentsByDate(appointments = []) {
  return appointments.reduce((groups, appointment) => {
    const dateKey = appointment?.data_agendada
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return groups

    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(appointment)
    return groups
  }, {})
}

export function getLastNavigableWeek(appointments = [], today = getLocalDateInputValue()) {
  const currentWeek = getWeekStartKey(today)

  return appointments.reduce((latestWeek, appointment) => {
    const dateKey = appointment?.data_agendada
    if (!dateKey || dateKey < today) return latestWeek

    const appointmentWeek = getWeekStartKey(dateKey)
    return appointmentWeek > latestWeek ? appointmentWeek : latestWeek
  }, currentWeek)
}

export function getWorkoutCounts(workout) {
  const sections = workout?.secoes_treino || []
  const exerciseCount = sections.reduce(
    (total, section) => total + (section?.treinos_exercicios?.length || 0),
    0
  )

  return {
    sectionCount: sections.length,
    exerciseCount,
  }
}

export function clampActiveIndex(index, length) {
  if (!Number.isFinite(index) || length <= 0) return 0
  return Math.min(Math.max(0, index), length - 1)
}
