import { normalizePeriod } from './historyModel.js'

export function canonicalHistoryParams(params) {
  const next = new URLSearchParams(params)
  next.set('period', normalizePeriod(next.get('period')))
  if (!next.get('workout')) {
    next.delete('workout')
    next.delete('exercise')
  }
  return next
}

export function periodHistoryParams(period) {
  return new URLSearchParams({ period: normalizePeriod(period) })
}

export function workoutHistoryParams(params, period, workoutId) {
  const next = canonicalHistoryParams(params)
  next.set('period', normalizePeriod(period))
  next.set('workout', String(workoutId))
  next.delete('exercise')
  return next
}

export function exerciseHistoryParams(params, exerciseId) {
  const next = canonicalHistoryParams(params)
  next.set('exercise', String(exerciseId))
  return next
}

export function parentHistoryParams(params, parent) {
  const next = canonicalHistoryParams(params)
  next.delete('exercise')
  if (parent === 'overview') next.delete('workout')
  return next
}
