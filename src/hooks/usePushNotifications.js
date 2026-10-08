import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { pushService } from '../services/push/pushService'
import { runPushOperation } from '../services/push/pushResults.js'

const initial = { status: 'default', permission: 'default', subscriptionId: null, error: null, busy: false }
export function usePushNotifications() {
  const { usuario } = useAuth()
  const [state, setState] = useState(initial)
  const generation = useRef(0)
  const pending = useRef(false)
  useEffect(() => {
    const current = ++generation.current
    setState(initial)
    if (usuario?.id) pushService.inspect().then((next) => {
      if (current === generation.current) setState({ ...initial, ...next })
    }).catch(() => { if (current === generation.current) setState({ ...initial, status: 'error', error: 'push_backend_failed' }) })
    return () => { ++generation.current }
  }, [usuario?.id])
  const run = useCallback(async (action) => {
    if (!usuario?.id || pending.current) return null
    const current = generation.current
    pending.current = true
    try {
      return await runPushOperation({ action, setState, isCurrent: () => current === generation.current })
    } finally { pending.current = false }
  }, [usuario?.id])
  return { ...state, enable: () => run(pushService.enable), disable: () => run(pushService.disable),
    sendTest: () => state.subscriptionId ? run(() => pushService.sendTest(state.subscriptionId)) : Promise.resolve(null) }
}
