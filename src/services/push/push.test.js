import test from 'node:test'
import assert from 'node:assert/strict'
import { detectPushSupport, normalizeSubscription, permissionState, vapidPublicKeyToBytes } from './pushUtils.js'
import { createPushController } from './pushController.js'
import { logoutWithPushCleanup } from '../auth/logoutLifecycle.js'

const publicKey = Buffer.from([4, ...Array(64).fill(7)]).toString('base64url')
const auth = Buffer.alloc(16, 9).toString('base64url')
function ports(permission = 'default') {
  const calls = []
  const data = new Map()
  let activeSubscription = null
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic',
    options: { applicationServerKey: vapidPublicKeyToBytes(publicKey) },
    toJSON: () => ({ endpoint: subscription.endpoint, keys: { p256dh: publicKey, auth }, expirationTime: null }),
    unsubscribe: async () => { calls.push('unsubscribe'); activeSubscription = null; return true },
  }
  const registration = {
    active: { scriptURL: 'http://localhost:5173/push-sw.js' },
    pushManager: { getSubscription: async () => activeSubscription, subscribe: async () => { calls.push('subscribe'); activeSubscription = subscription; return subscription } },
    unregister: async () => { calls.push('unregister'); return true },
  }
  const browser = { isSecureContext: true, location: { origin: 'http://localhost:5173' }, PushManager: function () {},
    localStorage: { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) },
    Notification: { permission, requestPermission: () => { calls.push('permission'); browser.Notification.permission = 'granted'; return Promise.resolve('granted') } },
    navigator: { serviceWorker: { getRegistration: async () => registration, register: async () => { calls.push('worker'); return registration } } } }
  const api = { lookup: async () => { calls.push('lookup'); return activeSubscription ? 'own-id' : null },
    register: async () => { calls.push('register'); return 'own-id' }, remove: async () => { calls.push('remove') }, sendTest: async () => ({ result: 'sent' }) }
  return { browser, api, calls, subscription, registration, controller: createPushController({ browser, api, publicKey, timeoutMs: 20 }) }
}

test('VAPID conversion handles URL-safe alphabet/padding and rejects invalid key sizes', () => {
  assert.equal(vapidPublicKeyToBytes(publicKey).length, 65)
  assert.deepEqual(vapidPublicKeyToBytes(publicKey + '='), vapidPublicKeyToBytes(publicKey))
  for (const invalid of ['', 'bad!', 'YQ', Buffer.alloc(65).toString('base64url')]) assert.throws(() => vapidPublicKeyToBytes(invalid))
})
test('normalization strips metadata and rejects insecure URLs and malformed keys', () => {
  const p = ports()
  assert.deepEqual(normalizeSubscription(p.subscription), { endpoint: p.subscription.endpoint, p256dh: publicKey, auth })
  for (const endpoint of ['http://example.com/', 'https://user:password@example.com/', 'https://example.com/#secret']) {
    assert.throws(() => normalizeSubscription({ endpoint, keys: { p256dh: publicKey, auth } }))
  }
  assert.throws(() => normalizeSubscription({ endpoint: p.subscription.endpoint, keys: { p256dh: publicKey, auth: 'YQ' } }))
})
test('support detection and permission states do not request permission', () => {
  const p = ports()
  assert.equal(detectPushSupport(p.browser), true)
  assert.equal(detectPushSupport({ ...p.browser, isSecureContext: false }), false)
  assert.equal(detectPushSupport(null), false)
  assert.deepEqual(['default', 'granted', 'denied'].map((v) => permissionState(v)), ['default', 'granted', 'denied'])
  assert.equal(permissionState('granted', true), 'subscribed')
  assert.equal(permissionState('granted', false, true), 'unsubscribed')
  assert.deepEqual(p.calls, [])
})
test('inspection is read-only and enabling invokes permission before asynchronous work', async () => {
  const p = ports()
  assert.equal((await p.controller.inspect()).status, 'default')
  assert.deepEqual(p.calls, [])
  const activation = p.controller.enable()
  assert.deepEqual(p.calls, ['permission'])
  assert.equal((await activation).status, 'subscribed')
  assert.deepEqual(p.calls, ['permission', 'worker', 'subscribe', 'register'])
  assert.equal((await p.controller.inspect()).subscriptionId, 'own-id')
})
test('denied permission does not register worker or subscription', async () => {
  const p = ports('denied')
  assert.equal((await p.controller.enable()).status, 'denied')
  assert.deepEqual(p.calls, [])
})
test('failed backend registration rolls back only a newly created browser subscription', async () => {
  const p = ports('granted')
  p.api.register = async () => { throw new Error('offline') }
  await assert.rejects(p.controller.enable())
  assert.ok(p.calls.includes('unsubscribe'))
})
test('repeated activation reuses owned subscription, without duplicate subscribe', async () => {
  const p = ports('granted')
  await p.controller.enable(); await p.controller.enable()
  assert.equal(p.calls.filter((v) => v === 'subscribe').length, 1)
  assert.equal(p.calls.filter((v) => v === 'register').length, 2)
})

test('explicit activation reconciles a rotated key/endpoint and removes only the previous owned ID', async () => {
  for (const removalFails of [false, true]) {
    const p = ports('granted'); await p.controller.enable()
    p.subscription.options.applicationServerKey = new Uint8Array(65)
    p.api.register = async (value) => { assert.equal(value.endpoint, p.subscription.endpoint); return 'new-own-id' }
    p.api.remove = async (id) => { assert.equal(id, 'own-id'); if (removalFails) throw new Error('offline') }
    p.registration.pushManager.subscribe = async () => {
      p.subscription.endpoint += '-rotated'; p.subscription.options.applicationServerKey = vapidPublicKeyToBytes(publicKey)
      return p.subscription
    }
    const result = await p.controller.enable()
    assert.equal(result.subscriptionId, 'new-own-id')
    assert.equal(result.status, 'subscribed')
    assert.deepEqual(result.warnings, removalFails ? ['rotated_subscription_cleanup_failed'] : [])
    // A failed removal of the previous record must not discard the newly registered subscription.
    assert.equal(p.calls.filter((v) => v === 'unsubscribe').length, 1)
  }
})
test('revocation attempts both cleanup operations and containment on failures', async () => {
  const p = ports('granted'); await p.controller.enable()
  p.api.remove = async () => { p.calls.push('remove'); throw new Error('offline') }
  p.subscription.unsubscribe = async () => { p.calls.push('unsubscribe'); throw new Error('browser_failure') }
  const result = await p.controller.disable()
  assert.deepEqual(result.warnings, ['remote_cleanup_failed', 'local_unsubscribe_failed'])
  assert.ok(p.calls.includes('remove') && p.calls.includes('unsubscribe') && p.calls.includes('unregister'))
  assert.equal((await p.controller.inspect()).status, 'unsubscribed')
})
test('logout always signs out after remote/local/both failures and cleanup timeout', async () => {
  for (const cleanup of [async () => ({ warnings: ['remote_cleanup_failed'] }), async () => ({ warnings: ['local_unsubscribe_failed'] }),
    async () => { throw new Error('both_failed') }, () => new Promise(() => {})]) {
    let signs = 0; let cleared = 0
    const result = await logoutWithPushCleanup({ cleanup, signOut: async () => { ++signs; return {} }, onSignedOut: () => ++cleared, timeoutMs: 5 })
    assert.equal(signs, 1); assert.equal(cleared, 1); assert.ok(result.warnings.length)
  }
})

test('real controller cleanup failures and timeout cannot prevent Auth signOut', async () => {
  for (const scenario of ['remote', 'local', 'both', 'timeout']) {
    const p = ports('granted'); await p.controller.enable()
    if (scenario === 'remote' || scenario === 'both') p.api.remove = async () => { throw new Error('offline') }
    if (scenario === 'local' || scenario === 'both') p.subscription.unsubscribe = async () => { throw new Error('browser_failure') }
    if (scenario === 'timeout') p.api.remove = () => new Promise(() => {})
    let signs = 0
    const result = await logoutWithPushCleanup({ cleanup: p.controller.disable, signOut: async () => { signs++; return {} }, timeoutMs: 100 })
    assert.equal(signs, 1)
    assert.ok(result.warnings.length)
    assert.equal((await p.controller.inspect()).status, 'unsubscribed')
    assert.ok(p.calls.includes('unregister'))
  }
})
test('Auth signOut errors retain existing failure behavior', async () => {
  const error = new Error('auth_failure')
  await assert.rejects(logoutWithPushCleanup({ cleanup: async () => ({}), signOut: async () => ({ error }) }), (value) => value === error)
})

test('inspection and explicit activation lookups time out, abort and never retry or create a subscription', async () => {
  for (const operation of ['inspect', 'enable']) {
    const p = ports('granted'); await p.controller.enable()
    const previousSubscriptions = p.calls.filter((call) => call === 'subscribe').length
    let calls = 0; let signal
    p.api.lookup = (_endpoint, incoming) => { calls++; signal = incoming; return new Promise(() => {}) }
    await assert.rejects(p.controller[operation](), /push_timeout/)
    assert.equal(calls, 1); assert.equal(signal.aborted, true)
    assert.equal(p.calls.filter((call) => call === 'subscribe').length, previousSubscriptions)
    assert.ok(!p.calls.includes('permission') && !p.calls.includes('unsubscribe'))
  }
})

test('registration timeout aborts once and rolls back the freshly created native subscription', async () => {
  const p = ports('granted')
  let calls = 0; let signal
  p.api.register = (_value, incoming) => { calls++; signal = incoming; return new Promise(() => {}) }
  await assert.rejects(p.controller.enable(), /push_timeout/)
  assert.equal(calls, 1); assert.equal(signal.aborted, true)
  assert.equal(p.calls.filter((call) => call === 'unsubscribe').length, 1)
  assert.equal((await p.controller.inspect()).subscriptionId, null)
})

test('failed rollback is contained locally and cannot leave enable pending', async () => {
  const p = ports('granted')
  p.api.register = async () => { throw new Error('offline') }
  p.subscription.unsubscribe = () => new Promise(() => {})
  await assert.rejects(p.controller.enable(), /offline/)
  assert.ok(p.calls.includes('unregister'))
  assert.equal((await p.controller.inspect()).status, 'unsubscribed')
})

test('test request times out with AbortSignal and makes exactly one attempt', async () => {
  const p = ports('granted')
  let calls = 0; let signal
  p.api.sendTest = (id, incoming) => { assert.equal(id, 'own-id'); calls++; signal = incoming; return new Promise(() => {}) }
  await assert.rejects(p.controller.sendTest('own-id'), /push_timeout/)
  assert.equal(calls, 1); assert.equal(signal.aborted, true)
})

test('rotated remote removal timeout reports partial cleanup without discarding the new subscription', async () => {
  const p = ports('granted'); await p.controller.enable()
  p.subscription.options.applicationServerKey = new Uint8Array(65)
  p.api.register = async () => 'new-own-id'
  let signal; let calls = 0
  p.api.remove = (id, incoming) => { assert.equal(id, 'own-id'); signal = incoming; calls++; return new Promise(() => {}) }
  const result = await p.controller.enable()
  assert.equal(result.subscriptionId, 'new-own-id')
  assert.deepEqual(result.warnings, ['rotated_subscription_cleanup_failed'])
  assert.equal(signal.aborted, true); assert.equal(calls, 1)
  assert.equal(p.calls.filter((call) => call === 'unsubscribe').length, 1)
})
