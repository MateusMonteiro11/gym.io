import { getLocalDateInputValue } from '../../utils/dateUtils.js'
import { getAverageWorkoutDuration, getExerciseExecutionsForPeriod, groupSetsBySession, isCompletedSession, sessionMetrics } from './historyModel.js'

export function profileWeekBounds(now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

export function aggregateWeeklyProfileStats(sessions, sets, now = new Date()) {
  const bounds = profileWeekBounds(now)
  const visible = sessions.filter((session) => isCompletedSession(session)
    && session.date >= bounds.start && session.date < bounds.end && session.date <= now)
  const exercises = getExerciseExecutionsForPeriod(visible, sets)
  const duration = getAverageWorkoutDuration(visible)
  const bySession = groupSetsBySession(sets)
  const metrics = visible.map((session) => {
    const rows = bySession.get(session.id) || []
    const metric = sessionMetrics(session, rows)
    if (!metric.reliability.sets && !rows.length) metric.sets = null
    return metric
  })
  const series = metrics.some((metric) => metric.sets == null)
    ? null : metrics.reduce((sum, metric) => sum + metric.sets, 0)
  const days = new Set(visible.map((session) => getLocalDateInputValue(session.date)))
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)
  if (!days.has(getLocalDateInputValue(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (cursor >= bounds.start && days.has(getLocalDateInputValue(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  const reliability = {
    exercises: exercises.reliable,
    series: metrics.every((metric) => metric.reliability.sets),
    duration: duration.reliable,
  }
  return {
    bounds, workouts: visible.length, exercises: exercises.value, series, streak,
    averageDuration: duration.value, reliability,
    partial: Object.values(reliability).some((reliable) => !reliable),
  }
}
