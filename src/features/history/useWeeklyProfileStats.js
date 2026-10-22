import { useEffect, useState } from 'react'
import { aggregateWeeklyProfileStats, profileWeekBounds } from './weeklyProfileStats.js'

const currentTime = () => new Date()

export function useWeeklyProfileStats(repository, userId, clock = currentTime) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState(null)
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const midnight = new Date(clock())
    midnight.setHours(24, 0, 0, 0)
    const timer = window.setTimeout(refresh, Math.max(1, +midnight - +clock()))
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [clock, revision])

  useEffect(() => {
    const controller = new AbortController()
    const now = clock()
    const bounds = profileWeekBounds(now)
    if (userId) {
      Promise.all([
        repository.sessions(userId, controller.signal, bounds),
        repository.sets(userId, bounds, controller.signal),
      ]).then(([sessions, sets]) => {
        if (!controller.signal.aborted) setState({ repository, userId, revision, status: 'ready', stats: aggregateWeeklyProfileStats(sessions, sets, now) })
      }).catch(() => {
        if (!controller.signal.aborted) setState({ repository, userId, revision, status: 'error' })
      })
    }
    return () => controller.abort()
  }, [repository, userId, revision, clock])

  const current = !userId ? { status: 'error' }
    : state?.repository === repository && state.userId === userId && state.revision === revision
      ? state : { status: 'loading' }
  return { ...current, retry: () => setRevision((value) => value + 1) }
}
