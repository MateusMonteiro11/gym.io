import { useCallback, useEffect, useState } from 'react'

export function useServerNow(serverOffsetMs = 0, enabled = true) {
  const getNow = useCallback(
    () => Date.now() + Number(serverOffsetMs || 0),
    [serverOffsetMs]
  )
  const [nowMs, setNowMs] = useState(getNow)

  useEffect(() => {
    const sync = () => setNowMs(getNow())

    sync()
    if (!enabled) return undefined

    const intervalId = window.setInterval(sync, 1000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sync()
    }

    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, getNow])

  return { nowMs, syncNow: () => setNowMs(getNow()) }
}

