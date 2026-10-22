import { bounded, PUSH_WORKER_URL, PUSH_SCOPE, PUSH_OPT_OUT_KEY } from './pushUtils.js'

export function createNotificationBridge(browser) {
  let epoch = 0
  let logoutEpoch = 0
  let blocked = false
  const registration = async () => {
    if (!browser?.isSecureContext || !browser.navigator?.serviceWorker) return null
    const value = await browser.navigator.serviceWorker.getRegistration(PUSH_SCOPE)
    return value?.active?.scriptURL === new URL(PUSH_WORKER_URL, browser.location.origin).href
      ? value : null
  }
  const allowed = () => !blocked && browser?.Notification?.permission === 'granted' &&
    browser.localStorage?.getItem(PUSH_OPT_OUT_KEY) !== '1'
  const send = async (message, version = epoch, force = false) => {
    try {
      if (version !== epoch || (!force && !allowed())) return false
      return await bounded(async (signal) => {
        const own = await registration()
        if (signal.aborted || version !== epoch || (!force && !allowed())) return false
        own?.active?.postMessage(message)
        return Boolean(own?.active)
      }, 500)
    } catch { return false }
  }
  return {
    captureLogoutEpoch: () => logoutEpoch,
    isCurrentLogoutEpoch: version => version === logoutEpoch,
    capture: async () => {
      const version = epoch
      try {
        if (!allowed()) return null
        return await bounded(async (signal) => {
          const own = await registration()
          if (!own || signal.aborted || version !== epoch || !allowed()) return null
          return new Promise((resolve) => {
            const channel = new browser.MessageChannel()
            const close = () => { channel.port1.close(); channel.port2.close() }
            signal.addEventListener('abort', close, { once: true })
            channel.port1.onmessage = ({ data }) => {
              close()
              resolve(version === epoch && allowed() && typeof data?.scope === 'string'
                ? { version, scope: data.scope } : null)
            }
            own.active.postMessage({ type: 'gymio_notification_scope' }, [channel.port2])
          })
        }, 500)
      } catch { return null }
    },
    complete: (payload, captured) => captured
      ? send({ type: 'gymio_workout_complete', payload, scope: captured.scope }, captured.version)
      : false,
    confirmSchedule: async (payload, captured) => {
      try {
        if (!captured || captured.version !== epoch || !allowed()) return false
        return await bounded(async signal => {
          const own = await registration()
          const subscription = await own?.pushManager?.getSubscription()
          if (!subscription || signal.aborted || captured.version !== epoch || !allowed()) return false
          return new Promise(resolve => {
            const channel = new browser.MessageChannel()
            const close = () => { channel.port1.close(); channel.port2.close() }
            signal.addEventListener('abort', close, { once: true })
            channel.port1.onmessage = ({ data }) => {
              close()
              resolve(captured.version === epoch && allowed() && data?.shown === true)
            }
            own.active.postMessage({ type: 'gymio_schedule_confirmation', payload, scope: captured.scope }, [channel.port2])
          })
        }, 2000)
      } catch { return false }
    },
    disable: async (reason) => {
      blocked = true
      epoch++
      if (reason === 'logout') logoutEpoch++
      await send({ type: 'gymio_push_disable' }, epoch, true)
    },
    enable: async () => {
      blocked = false
      epoch++
      await send({ type: 'gymio_push_enable' }, epoch, true)
    },
  }
}

export const notificationBridge = createNotificationBridge(typeof window === 'undefined' ? null : window)
