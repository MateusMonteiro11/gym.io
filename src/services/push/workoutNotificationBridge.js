import { bounded, PUSH_WORKER_URL, PUSH_SCOPE, PUSH_OPT_OUT_KEY } from './pushUtils.js'

function createWorkoutNotificationBridge(browser) {
  let blocked = false
  let epoch = 0

  const registration = async () => {
    if (!browser?.isSecureContext || !browser.navigator?.serviceWorker) return null
    const value = await browser.navigator.serviceWorker.getRegistration(PUSH_SCOPE)
    return value?.active?.scriptURL === new URL(PUSH_WORKER_URL, browser.location.origin).href
      ? value
      : null
  }
  const send = async (message, force = false, version = epoch) => {
    try {
      if (version !== epoch) return false
      if (
        !force &&
        (blocked ||
          browser?.Notification?.permission !== 'granted' ||
          browser.localStorage?.getItem(PUSH_OPT_OUT_KEY) === '1')
      )
        return false
      return await bounded(async (signal) => {
        const own = await registration()
        if (signal.aborted || version !== epoch || !own || (!force && blocked)) return false
        if (typeof own.active.postMessage !== 'function') return false
        own.active.postMessage(message)
        return true
      }, 500)
    } catch {
      return false
    }
  }
  return {
    capture: () => epoch,
    start: (payload, scope) => send({ type: 'gymio_workout_start', payload }, false, scope),
    complete: (payload, scope) => send({ type: 'gymio_workout_complete', payload }, false, scope),
    controls: (payload, scope) => send({ type: 'gymio_workout_controls', payload }, false, scope),
    project: (payload, scope) => send({ type: 'gymio_workout_projection', payload }, false, scope),
    restFinished: (payload, scope) =>
      send({ type: 'gymio_workout_rest_finished', payload }, false, scope),
    close: (sessionId) => send({ type: 'gymio_workout_close', sessionId }, true),
    disable: async (reason) => {
      blocked = true
      epoch++
      await send({ type: 'gymio_push_disable', reason }, true)
    },
    enable: async () => {
      blocked = false
      epoch++
      await send({ type: 'gymio_push_enable' }, true)
    },
  }
}

export const workoutNotificationBridge = createWorkoutNotificationBridge(
  typeof window === 'undefined' ? null : window
)
