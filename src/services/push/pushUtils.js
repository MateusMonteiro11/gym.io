export const PUSH_WORKER_URL = '/push-sw.js'
export const PUSH_SCOPE = '/'
export const PUSH_OPT_OUT_KEY = 'gymio-push-disabled'

function supportedMaxActions(browser) {
  const value = browser?.Notification?.maxActions
  return Number.isInteger(value) && value > 0 ? value : 0
}

export function workoutNotificationMode(browser) {
  return supportedMaxActions(browser) > 0 ? 'enhanced' : 'minimal'
}

export function detectPushSupport(browser) {
  return Boolean(
    browser?.isSecureContext &&
      browser.navigator?.serviceWorker &&
      browser.Notification?.requestPermission &&
      browser.PushManager
  )
}

function base64urlToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(value))
    throw new Error('invalid_key')
  const raw = value.replace(/=+$/, '')
  const binary = atob(
    raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (raw.length % 4)) % 4)
  )
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function vapidPublicKeyToBytes(value) {
  const bytes = base64urlToBytes(value)
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('invalid_vapid_public_key')
  return bytes
}

export function normalizeSubscription(subscription) {
  const value = subscription?.toJSON ? subscription.toJSON() : subscription
  if (!value || typeof value.endpoint !== 'string' || !value.keys)
    throw new Error('invalid_subscription')
  const endpoint = new URL(value.endpoint)
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    endpoint.port
  )
    throw new Error('invalid_subscription')
  const p256dh = value.keys.p256dh?.replace(/=+$/, '')
  const auth = value.keys.auth?.replace(/=+$/, '')
  const key = base64urlToBytes(p256dh)
  if (key.length !== 65 || key[0] !== 4 || base64urlToBytes(auth).length !== 16)
    throw new Error('invalid_subscription')
  return { endpoint: endpoint.href, p256dh, auth }
}

export function permissionState(permission, subscribed = false, disabled = false) {
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'default'
  if (subscribed) return 'subscribed'
  return disabled ? 'unsubscribed' : 'granted'
}

export async function bounded(operation, timeoutMs = 10000) {
  const controller = new AbortController()
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('push_timeout'))
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
