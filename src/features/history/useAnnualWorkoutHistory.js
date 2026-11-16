import { useEffect, useMemo, useRef, useState } from 'react'
import { createHistoryCache } from './historyRepository.js'
import { useHistoryResource } from './useHistoryData.js'

export function useAnnualWorkoutHistory(repository, userId, year, todayKey) {
  const cache = useMemo(() => createHistoryCache(), [repository, userId])
  const [revision, setRevision] = useState(0)
  const lastRefresh = useRef(Date.now())

  useEffect(() => {
    function refresh(event) {
      if (event?.type === 'visibilitychange' && document.visibilityState !== 'visible') return
      if (event?.type !== 'gymio:history-updated' && Date.now() - lastRefresh.current < 30000) return
      lastRefresh.current = Date.now()
      cache.clear()
      setRevision((value) => value + 1)
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('gymio:history-updated', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('gymio:history-updated', refresh)
      document.removeEventListener('visibilitychange', refresh)
      cache.clear()
    }
  }, [cache])

  const firstLoader = useMemo(() => (signal) => repository.firstActivityDate(userId, signal), [repository, userId])
  const yearLoader = useMemo(() => (signal) => repository.annualActivity(userId, year, signal), [repository, userId, year])
  const first = useHistoryResource(cache, `first:${todayKey}:${revision}`, firstLoader)
  const activity = useHistoryResource(cache, `annual:${year}:${todayKey}:${revision}`, yearLoader)
  return { first, activity, cache, revision, retry: () => { first.retry(); activity.retry() } }
}
