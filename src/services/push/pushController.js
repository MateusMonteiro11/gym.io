import {
  bounded,
  detectPushSupport,
  normalizeSubscription,
  permissionState,
  PUSH_OPT_OUT_KEY,
  PUSH_SCOPE,
  PUSH_WORKER_URL,
  vapidPublicKeyToBytes,
  workoutNotificationMode,
} from './pushUtils.js'

// Browser/API ports keep credentials and SDK error objects outside UI state.
export function createPushController({ browser, api, publicKey, timeoutMs = 10000 }) {
  let epoch = 0
  let registrationUnconfirmed = false
  const remote = (operation) => bounded(operation, timeoutMs)
  const optOut = (disabled) => {
    try {
      if (disabled) browser.localStorage?.setItem(PUSH_OPT_OUT_KEY, '1')
      else browser.localStorage?.removeItem(PUSH_OPT_OUT_KEY)
    } catch {
      /* storage is optional */
    }
  }
  const disabled = () => {
    try {
      return browser.localStorage?.getItem(PUSH_OPT_OUT_KEY) === '1'
    } catch {
      return false
    }
  }
  const ownRegistration = async () => {
    const registration = await browser.navigator.serviceWorker.getRegistration(PUSH_SCOPE)
    const worker = registration?.active ?? registration?.waiting ?? registration?.installing
    return worker?.scriptURL === new URL(PUSH_WORKER_URL, browser.location.origin).href
      ? registration
      : null
  }

  const inspect = async () => {
    if (!detectPushSupport(browser))
      return { status: 'unsupported', permission: 'default', subscriptionId: null }
    const permission = browser.Notification.permission
    if (!publicKey)
      return { status: 'error', permission, subscriptionId: null, error: 'push_not_configured' }
    const registration = await ownRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    const subscriptionId =
      subscription && permission === 'granted' && !disabled()
        ? await remote((signal) => api.lookup(subscription.endpoint, signal))
        : null
    if (registrationUnconfirmed && subscription && !disabled())
      return {
        status: 'error',
        error: 'push_registration_unconfirmed',
        permission,
        subscriptionId,
        workoutNotificationMode: null,
        warnings: ['push_registration_unconfirmed'],
      }
    return {
      status: permissionState(
        permission,
        Boolean(subscriptionId),
        disabled() || Boolean(subscription)
      ),
      permission,
      subscriptionId,
    }
  }

  const enable = async () => {
    if (!detectPushSupport(browser))
      return { status: 'unsupported', permission: 'default', subscriptionId: null }

    const activation = ++epoch
    vapidPublicKeyToBytes(publicKey)
    // Permission must be requested in the original click, before any await.
    const permissionPromise =
      browser.Notification.permission === 'default'
        ? browser.Notification.requestPermission()
        : Promise.resolve(browser.Notification.permission)
    const permission = await permissionPromise
    if (permission !== 'granted')
      return { status: permissionState(permission), permission, subscriptionId: null }
    if (activation !== epoch) throw new Error('activation_cancelled')
    const registration = await browser.navigator.serviceWorker.register(PUSH_WORKER_URL, {
      scope: PUSH_SCOPE,
      updateViaCache: 'none',
    })
    await bounded(
      () =>
        new Promise((resolve, reject) => {
          if (registration.active) return resolve()
          const worker = registration.installing ?? registration.waiting
          if (!worker) return reject(new Error('worker_unavailable'))
          const check = () => {
            if (worker.state === 'activated') {
              worker.removeEventListener('statechange', check)
              resolve()
            } else if (worker.state === 'redundant') {
              worker.removeEventListener('statechange', check)
              reject(new Error('worker_unavailable'))
            }
          }
          worker.addEventListener('statechange', check)
          check()
        }),
      timeoutMs
    )
    let subscription = await registration.pushManager.getSubscription()
    let oldId = null
    if (subscription) {
      oldId = await remote((signal) => api.lookup(subscription.endpoint, signal))
      const expected = vapidPublicKeyToBytes(publicKey)
      const existing = subscription.options?.applicationServerKey
      const sameKey =
        existing &&
        new Uint8Array(existing).length === expected.length &&
        new Uint8Array(existing).every((v, i) => v === expected[i])
      if (!oldId || !sameKey) {
        if (!(await subscription.unsubscribe())) throw new Error('unsubscribe_failed')
        subscription = null
      }
    }
    let created = false
    try {
      if (activation !== epoch) throw new Error('activation_cancelled')
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKeyToBytes(publicKey),
        })
        created = true
      }
      if (activation !== epoch) throw new Error('activation_cancelled')
      const normalized = normalizeSubscription(subscription)
      const mode = workoutNotificationMode(browser)
      let subscriptionId
      try {
        // One atomic write; ambiguous responses permit only read-only reconciliation.
        subscriptionId = await remote((signal) => api.registerWithMode(normalized, mode, signal))
      } catch (error) {
        if (error?.registrationRejected) throw error
        if (activation !== epoch) throw new Error('activation_cancelled')
        registrationUnconfirmed = true
        let observedId = null
        try {
          observedId = await remote((signal) => api.lookup(subscription.endpoint, signal))
        } catch {
          /* read-only reconciliation is optional */
        }
        if (activation !== epoch) throw new Error('activation_cancelled')
        return {
          status: 'error',
          error: 'push_registration_unconfirmed',
          permission,
          subscriptionId: observedId,
          workoutNotificationMode: null,
          warnings: ['push_registration_unconfirmed'],
        }
      }
      const warnings = []
      if (oldId && oldId !== subscriptionId) {
        try {
          await remote((signal) => api.remove(oldId, signal))
        } catch {
          warnings.push('rotated_subscription_cleanup_failed')
        }
      }
      if (activation !== epoch) {
        await remote((signal) => api.remove(subscriptionId, signal))
        throw new Error('activation_cancelled')
      }
      registrationUnconfirmed = false
      optOut(false)
      return {
        status: 'subscribed',
        permission,
        subscriptionId,
        workoutNotificationMode: mode,
        warnings,
      }
    } catch (error) {
      if (created) {
        try {
          if (!(await bounded(() => subscription.unsubscribe(), timeoutMs)))
            throw new Error('unsubscribe_failed')
        } catch {
          optOut(true)
          try {
            await bounded(() => registration.unregister(), timeoutMs)
          } catch {
            /* best-effort */
          }
        }
      }
      throw error
    }
  }

  const disable = async () => {
    ++epoch
    registrationUnconfirmed = false
    optOut(true)
    if (!detectPushSupport(browser)) return { status: 'unsubscribed', warnings: [] }
    const warnings = []
    let registration
    let subscription
    try {
      registration = await bounded(ownRegistration, timeoutMs)
      subscription = await bounded(() => registration?.pushManager.getSubscription(), timeoutMs)
    } catch {
      warnings.push('push_cleanup_failed')
    }
    if (subscription) {
      const outcomes = await Promise.allSettled([
        bounded(async (signal) => {
          const id = await api.lookup(subscription.endpoint, signal)
          if (id) await api.remove(id, signal)
        }, timeoutMs),
        bounded(async () => {
          if (!(await subscription.unsubscribe())) throw new Error('unsubscribe_failed')
        }, timeoutMs),
      ])
      if (outcomes[0].status === 'rejected') warnings.push('remote_cleanup_failed')
      if (outcomes[1].status === 'rejected') warnings.push('local_unsubscribe_failed')
    }
    if (warnings.length && registration) {
      try {
        await bounded(() => registration.unregister(), timeoutMs)
      } catch {
        warnings.push('containment_failed')
      }
    }
    return {
      status: 'unsubscribed',
      permission: browser.Notification.permission,
      subscriptionId: null,
      warnings,
    }
  }
  return {
    inspect,
    enable,
    disable,
  }
}
