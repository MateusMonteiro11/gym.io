import { normalizeDatabaseUtcTimestamp, parseDateTime, getLocalDateInputValue } from '../../utils/dateUtils.js'

export const PERIODS = {
  '30d': { label: '30 dias' },
  all: { label: 'Total' },
}

export const FEATURED_EXERCISES_LIMIT = 3
export const RECENT_HISTORY_LIMIT = 12

export const TREND_METRICS = {
  workouts: { label: 'Treinos', unit: '' },
  duration: { label: 'Duração', unit: 'min' },
  exercises: { label: 'Exercícios', unit: '' },
}

export const METRICS = {
  weight: { label: 'Carga', unit: 'kg', description: 'Maior carga concluída em cada sessão.' },
}

export const numberLabel = (value, digits = 0) => value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)
export const compactNumberLabel = (value, digits = 1) => value == null ? '—' : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: digits }).format(value)
export const shortDate = (value) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(value).replaceAll('.', '').replace(' de ', ' ')
export const timeLabel = (value) => value ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(value) : 'Horário não registrado'
export const normalizePeriod = (value) => Object.hasOwn(PERIODS, value) ? value : '30d'

export function recordedNumber(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function recordedDate(value) {
  const date = parseDateTime(normalizeDatabaseUtcTimestamp(value))
  return date && Number.isFinite(date.getTime()) ? date : null
}

export function durationLabel(seconds) {
  if (seconds == null) return '—'
  const total = Math.floor(seconds)
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}`
}

export function normalizeSession(row) {
  return {
    id: row.id_historico == null ? null : String(row.id_historico),
    name: row.treinos?.nome || 'Treino registrado',
    date: recordedDate(row.data_execucao),
    duration: recordedNumber(row.duracao_segundos),
    recordedSets: recordedNumber(row.total_series),
    exerciseCount: recordedNumber(row.total_exercicios),
    recordingSessionId: row.id_sessao ?? null,
  }
}

export function normalizeSet(row) {
  const categoryRelation = Array.isArray(row.exercicios?.categorias_musculares)
    ? row.exercicios.categorias_musculares[0]
    : row.exercicios?.categorias_musculares
  return {
    id: row.id_historico_exercicio == null ? null : String(row.id_historico_exercicio),
    sessionId: row.id_historico == null ? null : String(row.id_historico),
    exerciseId: row.id_exercicio == null ? null : String(row.id_exercicio),
    name: row.exercicios?.nome || 'Exercício registrado',
    categoryId: categoryRelation?.id_categoria == null ? null : String(categoryRelation.id_categoria),
    categoryName: categoryRelation?.nome?.trim() || null,
    placementId: row.id_treino_exercicio == null ? null : String(row.id_treino_exercicio),
    series: recordedNumber(row.serie),
    weight: recordedNumber(row.carga_utilizada),
    reps: recordedNumber(row.repeticoes_feitas),
    complete: typeof row.concluido === 'boolean' ? row.concluido : null,
    date: recordedDate(row.criado_em),
  }
}

function startOfDay(value) {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(value, amount) {
  const result = new Date(value)
  result.setDate(result.getDate() + amount)
  return result
}

function addMonths(value, amount) {
  const result = new Date(value)
  result.setDate(1)
  result.setMonth(result.getMonth() + amount)
  return result
}

function startOfWeek(value) {
  const result = startOfDay(value)
  result.setDate(result.getDate() - result.getDay())
  return result
}

function startOfMonth(value) {
  const result = startOfDay(value)
  result.setDate(1)
  return result
}

function calendarDayNumber(value) {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000
}

function calendarDaysInclusive(start, end) {
  return Math.max(1, calendarDayNumber(startOfDay(end)) - calendarDayNumber(startOfDay(start)) + 1)
}

export function isCompletedSession(session) {
  return Boolean(session?.id && session.date instanceof Date && Number.isFinite(session.date.getTime()))
}

export function periodBounds(period, now = new Date()) {
  if (normalizePeriod(period) === 'all') return { start: null, end: null }
  return { start: startOfDay(addDays(now, -29)), end: new Date(now) }
}

export function sessionsInRange(sessions, start, end) {
  return sessions.filter((item) => isCompletedSession(item) && (!start || item.date >= start) && (!end || item.date < end))
}

export function periodSessions(sessions, period, now = new Date()) {
  const { start, end } = periodBounds(period, now)
  return sessionsInRange(sessions, start, end)
}

export function getCompletedWorkoutsForPeriod(sessions, period, now = new Date()) {
  return periodSessions(sessions, period, now)
}

function rowsForSessions(sessions, sets) {
  const ids = new Set(sessions.map((item) => item.id))
  return sets.filter((item) => item.sessionId && ids.has(item.sessionId))
}

function setEvidence(session, sets) {
  const rows = sets.filter((item) => item.sessionId === session.id)
  const missingRows = session.recordedSets != null && rows.length < session.recordedSets
  const unknownCompletion = rows.some((item) => item.complete == null)
  const completed = rows.filter((item) => item.complete === true)
  if (!rows.length && session.recordedSets == null) return { value: null, reliable: false }
  return { value: completed.length, reliable: !missingRows && !unknownCompletion }
}

export function resolveExerciseCount(session, sets) {
  if (session.exerciseCount != null) return { value: session.exerciseCount, reliable: true, source: 'session' }
  const rows = sets.filter((item) => item.sessionId === session.id)
  if (!rows.length) {
    return session.recordedSets === 0
      ? { value: 0, reliable: true, source: 'sets' }
      : { value: null, reliable: false, source: 'missing' }
  }
  const completed = rows.filter((item) => item.complete === true && item.exerciseId)
  const occurrences = new Set(completed.map((item) => `${item.exerciseId}:${item.placementId ?? 'legacy'}`))
  const missingRows = session.recordedSets != null && rows.length < session.recordedSets
  const unknownCompletion = rows.some((item) => item.complete == null)
  return { value: occurrences.size, reliable: !missingRows && !unknownCompletion, source: 'sets' }
}

export function getExerciseExecutionsForPeriod(sessions, sets) {
  if (!sessions.length) return { value: 0, reliable: true }
  const values = sessions.map((session) => resolveExerciseCount(session, sets))
  if (values.some((item) => item.value == null)) return { value: null, reliable: false }
  return {
    value: values.reduce((sum, item) => sum + item.value, 0),
    reliable: values.every((item) => item.reliable),
  }
}

export function getAverageWorkoutDuration(sessions) {
  if (!sessions.length) return { value: 0, reliable: true }
  const values = sessions.map((item) => item.duration).filter((value) => value != null)
  return {
    value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    reliable: values.length === sessions.length,
  }
}

export function getCurrentWeekActiveDays(sessions, now = new Date()) {
  const weekStart = startOfWeek(now)
  return new Set(sessions
    .filter((item) => isCompletedSession(item) && item.date >= weekStart && item.date <= now)
    .map((item) => getLocalDateInputValue(item.date))).size
}

export function buildOverview(sessions, sets, period, now = new Date()) {
  const visible = periodSessions(sessions, period, now)
  const exercises = getExerciseExecutionsForPeriod(visible, sets)
  const duration = getAverageWorkoutDuration(visible)
  return {
    workouts: visible.length,
    exercises: exercises.value,
    averageDuration: duration.value,
    weekActiveDays: getCurrentWeekActiveDays(sessions, now),
    reliability: { workouts: true, exercises: exercises.reliable, averageDuration: duration.reliable, weekActiveDays: true },
    partial: !exercises.reliable || !duration.reliable,
  }
}

function bucketConfiguration(period, visible, now) {
  if (normalizePeriod(period) === '30d') return { unit: 'week', start: startOfWeek, next: (date) => addDays(date, 7) }
  const earliest = visible[0]?.date || now
  const spanDays = calendarDaysInclusive(earliest, now)
  return spanDays <= 26 * 7
    ? { unit: 'week', start: startOfWeek, next: (date) => addDays(date, 7) }
    : { unit: 'month', start: startOfMonth, next: (date) => addMonths(date, 1) }
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date).replace('.', '')
}

function weekLabel(start, end) {
  return `${shortDate(start)} – ${shortDate(end)}`
}

const TREND_FIELDS = {
  workouts: 'workouts',
  duration: 'averageDuration',
  exercises: 'exerciseCount',
}

export function getTrendMetricValue(bucket, metric) {
  return bucket?.[TREND_FIELDS[metric] || TREND_FIELDS.workouts] ?? null
}

export function isTrendBucketPopulated(bucket, metric) {
  const value = getTrendMetricValue(bucket, metric)
  return metric === 'duration' ? value != null : value > 0
}

export function hasSufficientTrendData(buckets, metric) {
  return buckets.filter((bucket) => isTrendBucketPopulated(bucket, metric)).length >= 2
}

export function buildHistoryBuckets(sessions, sets, period, now = new Date()) {
  const visible = periodSessions(sessions, period, now).sort((a, b) => a.date - b.date)
  if (!visible.length && normalizePeriod(period) === 'all') return []
  const bounds = periodBounds(period, now)
  const rangeStart = startOfDay(bounds.start || visible[0]?.date)
  const rangeEnd = startOfDay(now)
  if (!rangeStart) return []
  const configuration = bucketConfiguration(period, visible, now)
  const buckets = []

  for (let cursor = configuration.start(rangeStart); cursor <= rangeEnd; cursor = configuration.next(cursor)) {
    const next = configuration.next(cursor)
    const naturalEnd = addDays(next, -1)
    const startDate = cursor < rangeStart ? rangeStart : cursor
    const endDate = naturalEnd > rangeEnd ? rangeEnd : naturalEnd
    const bucketSessions = visible.filter((item) => item.date >= startDate && item.date < next)
    const duration = bucketSessions.length
      ? getAverageWorkoutDuration(bucketSessions)
      : { value: null, reliable: true }
    const exercises = getExerciseExecutionsForPeriod(
      bucketSessions,
      rowsForSessions(bucketSessions, sets),
    )
    const isPartial = calendarDayNumber(startDate) > calendarDayNumber(cursor)
      || calendarDayNumber(endDate) < calendarDayNumber(naturalEnd)

    buckets.push({
      key: `${configuration.unit}:${getLocalDateInputValue(cursor)}`,
      unit: configuration.unit,
      startDate,
      endDate,
      timestamp: +startDate,
      label: configuration.unit === 'week' ? weekLabel(startDate, endDate) : monthLabel(cursor),
      isPartial,
      workouts: bucketSessions.length,
      averageDuration: duration.value,
      exerciseCount: exercises.value,
      reliability: {
        workouts: true,
        averageDuration: duration.reliable,
        exerciseCount: exercises.reliable,
      },
    })
  }

  return buckets
}

export function buildTrend(sessions, sets, period, metric, now = new Date()) {
  const field = TREND_FIELDS[metric] || TREND_FIELDS.workouts
  return buildHistoryBuckets(sessions, sets, period, now).map((bucket) => ({
    key: bucket.key,
    unit: bucket.unit,
    startDate: bucket.startDate,
    endDate: bucket.endDate,
    timestamp: bucket.timestamp,
    label: bucket.label,
    value: bucket[field],
    workouts: bucket.workouts,
    partialData: !bucket.reliability[field],
    partialRange: bucket.isPartial,
  }))
}

function categoryOccurrenceKey(row) {
  return `${row.sessionId}:${row.placementId ?? `legacy-${row.exerciseId}`}`
}

/**
 * Counts exercise appearances, never individual set rows. Percentages use only
 * resolved categories; unresolved appearances remain visible as partial data.
 */
export function getCategoryDistribution(sessions, sets) {
  const validSessions = new Map(sessions.filter(isCompletedSession).map((session) => [session.id, session]))
  const occurrences = new Map()

  for (const row of sets) {
    const session = validSessions.get(row.sessionId)
    if (!session || !row.exerciseId) continue
    const key = categoryOccurrenceKey(row)
    const current = occurrences.get(key) || { key, sessionId: session.id, timestamp: +session.date, rows: [] }
    current.rows.push(row)
    occurrences.set(key, current)
  }

  let unresolved = 0
  const categories = new Map()
  const observedBySession = new Map()

  for (const occurrence of occurrences.values()) {
    observedBySession.set(occurrence.sessionId, (observedBySession.get(occurrence.sessionId) || 0) + 1)
    const completedRows = occurrence.rows.filter((row) => row.complete === true)
    if (!completedRows.length) {
      if (occurrence.rows.some((row) => row.complete == null)) unresolved += 1
      continue
    }

    const categorized = completedRows.find((row) => row.categoryName) || occurrence.rows.find((row) => row.categoryName)
    if (!categorized?.categoryName) {
      unresolved += 1
      continue
    }

    const id = categorized.categoryId || `name:${categorized.categoryName.toLocaleLowerCase('pt-BR')}`
    const current = categories.get(id) || { id, name: categorized.categoryName, count: 0, lastPerformed: 0 }
    current.count += 1
    current.lastPerformed = Math.max(current.lastPerformed, occurrence.timestamp)
    categories.set(id, current)
  }

  for (const session of validSessions.values()) {
    if (session.exerciseCount == null) continue
    unresolved += Math.max(0, session.exerciseCount - (observedBySession.get(session.id) || 0))
  }

  const total = [...categories.values()].reduce((sum, category) => sum + category.count, 0)
  const maximum = Math.max(0, ...categories.values().map((category) => category.count))
  const items = [...categories.values()]
    .map((category) => ({
      ...category,
      percentage: total ? category.count / total * 100 : 0,
      intensity: maximum ? category.count / maximum : 0,
    }))
    .sort((a, b) => b.count - a.count || b.lastPerformed - a.lastPerformed || a.name.localeCompare(b.name, 'pt-BR'))

  return { items, total, unresolved, reliable: unresolved === 0 }
}

/**
 * Summarizes exercise participation and recorded loads without counting set rows
 * as separate workout appearances.
 */
export function getFeaturedExercises(sessions, sets) {
  const validSessions = new Map(sessions.filter(isCompletedSession).map((session) => [session.id, session]))
  const exercises = new Map()
  const rowsBySession = new Map()
  let occurrencePartial = false
  let loadPartial = false

  for (const row of sets) {
    const session = validSessions.get(row.sessionId)
    if (!session) continue

    if (!rowsBySession.has(session.id)) rowsBySession.set(session.id, [])
    rowsBySession.get(session.id).push(row)

    if (row.complete == null) {
      occurrencePartial = true
      loadPartial = true
    }
    if (row.complete !== true) continue
    if (!row.exerciseId) {
      occurrencePartial = true
      loadPartial = true
      continue
    }

    const timestamp = +session.date
    const current = exercises.get(row.exerciseId) || {
      id: row.exerciseId,
      name: row.name,
      categoryName: row.categoryName,
      labelTimestamp: timestamp,
      sessionIds: new Set(),
      lastPerformed: 0,
      bestWeight: null,
      bestWeightTimestamp: 0,
    }

    current.sessionIds.add(session.id)
    current.lastPerformed = Math.max(current.lastPerformed, timestamp)
    if (timestamp >= current.labelTimestamp) {
      current.name = row.name || current.name
      current.categoryName = row.categoryName || current.categoryName
      current.labelTimestamp = timestamp
    }

    const hasValidWeight = typeof row.weight === 'number' && Number.isFinite(row.weight) && row.weight >= 0
    if (!hasValidWeight) {
      loadPartial = true
    } else if (
      current.bestWeight == null
      || row.weight > current.bestWeight
      || (row.weight === current.bestWeight && timestamp > current.bestWeightTimestamp)
    ) {
      current.bestWeight = row.weight
      current.bestWeightTimestamp = timestamp
    }

    exercises.set(row.exerciseId, current)
  }

  for (const session of validSessions.values()) {
    const rows = rowsBySession.get(session.id) || []
    const observedOccurrences = new Set(rows
      .filter((row) => row.exerciseId)
      .map((row) => `${row.exerciseId}:${row.placementId ?? 'legacy'}`))
    const missingRows = session.recordedSets != null && rows.length < session.recordedSets
    const missingOccurrences = session.exerciseCount != null && observedOccurrences.size < session.exerciseCount
    if (missingRows || missingOccurrences) {
      occurrencePartial = true
      loadPartial = true
    }
  }

  const mostPerformed = [...exercises.values()]
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      categoryName: exercise.categoryName,
      sessionCount: exercise.sessionIds.size,
      lastPerformed: exercise.lastPerformed,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount || b.lastPerformed - a.lastPerformed || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, FEATURED_EXERCISES_LIMIT)

  const highestLoads = [...exercises.values()]
    .filter((exercise) => exercise.bestWeight != null)
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      categoryName: exercise.categoryName,
      weight: exercise.bestWeight,
      lastPerformed: exercise.bestWeightTimestamp,
    }))
    .sort((a, b) => b.weight - a.weight || b.lastPerformed - a.lastPerformed || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, FEATURED_EXERCISES_LIMIT)

  return {
    mostPerformed,
    highestLoads,
    partial: { occurrences: occurrencePartial, loads: loadPartial },
  }
}

const stableId = (a, b) => String(a.id ?? '').localeCompare(String(b.id ?? ''), 'en', { numeric: true })

export function groupExercises(sets, session) {
  const sequenced = Boolean(session?.recordingSessionId) && sets.every((set) => set.date && (!session.date || set.date >= session.date))
  const sorted = [...sets].sort((a, b) => {
    if (sequenced && +a.date !== +b.date) return a.date - b.date
    return stableId(a, b)
  })
  const groups = new Map()
  for (const set of sorted) {
    if (!set.exerciseId) continue
    const key = `${set.exerciseId}:${set.placementId ?? 'legacy'}`
    if (!groups.has(key)) groups.set(key, { key, exerciseId: set.exerciseId, name: set.name, sets: [], date: session?.recordingSessionId && set.date && (!session.date || set.date >= session.date) ? set.date : null })
    groups.get(key).sets.push(set)
  }
  return [...groups.values()]
}

export function availableExercises(sessions, sets) {
  const sessionMap = new Map(sessions.filter(isCompletedSession).map((session) => [session.id, session]))
  const options = new Map()
  for (const row of sets) {
    const session = sessionMap.get(row.sessionId)
    if (!session || !row.exerciseId || row.complete !== true) continue
    const current = options.get(row.exerciseId) || { id: row.exerciseId, name: row.name, sessionIds: new Set(), lastPerformed: 0 }
    current.name = row.name || current.name
    current.sessionIds.add(session.id)
    current.lastPerformed = Math.max(current.lastPerformed, +session.date)
    options.set(row.exerciseId, current)
  }
  return [...options.values()].map((item) => ({ id: item.id, name: item.name, frequency: item.sessionIds.size, lastPerformed: item.lastPerformed })).sort((a, b) => b.lastPerformed - a.lastPerformed || b.frequency - a.frequency || a.name.localeCompare(b.name, 'pt-BR'))
}

export function buildEvolution(sessions, sets, exerciseId) {
  const selected = sets.filter((item) => item.exerciseId === exerciseId)
  const grouped = new Map()
  for (const item of selected) {
    if (!grouped.has(item.sessionId)) grouped.set(item.sessionId, [])
    grouped.get(item.sessionId).push(item)
  }
  return sessions.filter((session) => isCompletedSession(session) && grouped.has(session.id)).map((session) => {
    const rows = grouped.get(session.id)
    const completed = rows.filter((item) => item.complete === true)
    const valid = completed.filter((item) => item.weight != null).sort((a, b) => b.weight - a.weight || (b.reps ?? -1) - (a.reps ?? -1) || stableId(a, b))
    return {
      sessionId: session.id,
      timestamp: +session.date,
      name: session.name,
      value: valid[0]?.weight ?? null,
      reps: valid[0]?.reps ?? null,
      partial: rows.some((item) => item.complete == null) || valid.length < completed.length,
    }
  }).sort((a, b) => a.timestamp - b.timestamp || a.sessionId.localeCompare(b.sessionId, 'en', { numeric: true }))
}

export function evolutionInsight(points) {
  const valid = points.filter((point) => point.value != null)
  if (!valid.length) return 'Ainda não há cargas concluídas para este exercício.'
  if (valid.length === 1) return 'Mais treinos são necessários para visualizar a evolução deste exercício.'
  if (valid.some((point) => point.partial)) return 'Algumas sessões têm dados incompletos; a curva usa apenas as cargas registradas.'
  const delta = valid.at(-1).value - valid[0].value
  if (delta === 0) return `A carga registrada permaneceu em ${numberLabel(valid[0].value, 2)} kg entre a primeira e a última sessão.`
  return `${delta > 0 ? '+' : '−'}${numberLabel(Math.abs(delta), 2)} kg entre a primeira e a última sessão do período.`
}

export function exerciseSummary(sessions, sets, exerciseId) {
  const points = buildEvolution(sessions, sets, exerciseId).filter((point) => point.value != null)
  if (!points.length) return { latest: null, best: null, variation: null, reliable: false }
  const latest = points.at(-1)
  const best = points.reduce((winner, point) => point.value > winner.value ? point : winner, points[0])
  const reliable = !points.some((point) => point.partial)
  const variation = reliable && points.length > 1 && points[0].value > 0 ? (latest.value - points[0].value) / points[0].value * 100 : null
  return { latest, best, variation, reliable }
}

export function sessionMetrics(session, sets) {
  if (!Array.isArray(sets)) {
    return {
      sets: session.recordedSets,
      exercises: session.exerciseCount,
      reliability: {
        sets: session.recordedSets != null,
        exercises: session.exerciseCount != null,
        duration: session.duration != null,
      },
    }
  }
  const setResult = setEvidence(session, sets)
  const exerciseResult = resolveExerciseCount(session, sets)
  return {
    sets: setResult.value,
    exercises: exerciseResult.value,
    reliability: { sets: setResult.reliable, exercises: exerciseResult.reliable, duration: session.duration != null },
  }
}
