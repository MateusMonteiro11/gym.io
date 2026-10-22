import { useEffect, useMemo, useState } from 'react'
import { createHistoryCache } from './historyRepository.js'
import { periodBounds, RECENT_HISTORY_LIMIT } from './historyModel.js'

export function useHistoryResource(cache, key, loader) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ cache: null, key: null, status: 'loading', data: [] })
  useEffect(() => {
    let active = true
    setState({ cache, key, status: 'loading', data: [] })
    cache.load(key, loader).then(
      (data) => { if (active) setState({ cache, key, status: 'ready', data }) },
      (error) => { if (active) setState({ cache, key, status: 'error', data: [], error }) },
    )
    return () => { active = false; cache.cancelPending(key) }
  }, [cache, key, loader, attempt])
  const current = state.cache === cache && state.key === key ? state : { status: 'loading', data: [] }
  return { ...current, retry: () => { cache.remove(key); setAttempt((value) => value + 1) } }
}

export function useHistoryData(repository, userId, period, now) {
  const cache = useMemo(() => createHistoryCache(), [userId, repository])
  useEffect(() => () => cache.clear(), [cache])
  const bounds = useMemo(() => periodBounds(period, now), [period, now])
  const loadSessions = useMemo(() => (signal) => repository.sessions(userId, signal, bounds), [repository, userId, bounds])
  const loadRecentSessions = useMemo(() => (signal) => repository.recentSessions(userId, signal), [repository, userId])
  const loadSets = useMemo(() => (signal) => repository.sets(userId, { start: bounds.start, end: bounds.end }, signal), [repository, userId, bounds])
  const sessions = useHistoryResource(cache, `sessions:${period}:${+now}`, loadSessions)
  const recentSessions = useHistoryResource(cache, `recent:${RECENT_HISTORY_LIMIT}`, loadRecentSessions)
  const sets = useHistoryResource(cache, `period:${period}:${+now}`, loadSets)
  return { sessions, recentSessions, sets, cache, retry: () => { sessions.retry(); recentSessions.retry(); sets.retry() } }
}

export function useSessionDetail(repository, userId, sessionId, cache) {
  const loader = useMemo(() => (signal) => sessionId ? repository.sets(userId, { sessionId }, signal) : Promise.resolve([]), [repository, userId, sessionId])
  return useHistoryResource(cache, `detail:${sessionId ?? ''}`, loader)
}
