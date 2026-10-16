import test from 'node:test'
import assert from 'node:assert/strict'
import { workoutNotificationMode, supportedMaxActions } from './pushUtils.js'
import { createPushController } from './pushController.js'
import { registerPushWithMode } from './registerPushWithMode.js'
import { logoutWithPushCleanup } from '../auth/logoutLifecycle.js'

const key = Buffer.from([4, ...Array(64).fill(7)]).toString('base64url')
function fixture(maxActions) {
  const calls = [], records = new Map()
  let subscription = null
  const native = { endpoint: 'https://fcm.googleapis.com/fcm/send/d-synthetic',
    options: { applicationServerKey: Uint8Array.from(Buffer.from(key, 'base64url')) },
    toJSON: () => ({ endpoint: native.endpoint, keys: { p256dh: key, auth: Buffer.alloc(16, 1).toString('base64url') } }),
    unsubscribe: async () => { calls.push('unsubscribe'); subscription = null; return true } }
  const registration = { active: { scriptURL: 'http://localhost:5173/push-sw.js' },
    pushManager: { getSubscription: async () => subscription, subscribe: async () => { calls.push('subscribe'); subscription = native; return native } },
    unregister: async () => true }
  const browser = { isSecureContext: true, location: { origin: 'http://localhost:5173' }, PushManager() {},
    Notification: { maxActions, permission: 'default', requestPermission: async () => { calls.push('permission'); browser.Notification.permission = 'granted'; return 'granted' } },
    navigator: { serviceWorker: { getRegistration: async () => registration, register: async () => { calls.push('worker'); return registration } } } }
  const api = { lookup: async () => { calls.push('lookup'); return records.has('own') ? 'own' : null },
    registerWithMode: async (_value, mode) => { calls.push(['register', mode]); records.set('own', mode); return 'own' },
    remove: async () => { calls.push('remove'); records.clear() } }
  return { calls, records, api, browser, controller: createPushController({ browser, api, publicKey: key, timeoutMs: 10 }) }
}

test('D classification is exactly the worker strict positive integer feature detection', () => {
  for (const value of [undefined, null, 0, -1, 1.2, NaN, Infinity, '2', true, {}, []]) {
    assert.equal(supportedMaxActions({ Notification: { maxActions: value } }), 0)
    assert.equal(workoutNotificationMode({ Notification: { maxActions: value } }), 'minimal')
  }
  for (const value of [1, 2, 3, 9]) assert.equal(workoutNotificationMode({ Notification: { maxActions: value } }), 'enhanced')
  assert.equal(workoutNotificationMode(null), 'minimal')
})

test('activation sends one atomic registration; inspection remains read-only', async () => {
  for (const value of [undefined, 0, 1, 2, 3, -1, '3']) {
    const f = fixture(value)
    await f.controller.inspect(); assert.deepEqual(f.calls, [])
    const result = await f.controller.enable(), mode = workoutNotificationMode(f.browser)
    assert.equal(result.workoutNotificationMode, mode); assert.equal(f.records.get('own'), mode)
    assert.deepEqual(f.calls, ['permission', 'worker', 'subscribe', ['register', mode]])
    f.calls.length = 0; await f.controller.inspect(); assert.deepEqual(f.calls, ['lookup'])
  }
})

for (const maxActions of [0, 2]) for (const committed of [false, true]) {
  test('ambiguous atomic response preserves the only detected mode: ' + maxActions + '/' + committed, async () => {
    const f = fixture(maxActions), modes = []
    f.api.registerWithMode = async (_value, mode) => {
      modes.push(mode); if (committed) f.records.set('own', mode)
      throw Error('sensitive transport detail')
    }
    const result = await f.controller.enable(), mode = workoutNotificationMode(f.browser)
    assert.deepEqual(modes, [mode]); assert.equal(f.records.get('own'), committed ? mode : undefined)
    assert.equal(result.status, 'error'); assert.equal(result.error, 'push_registration_unconfirmed')
    assert.equal(result.subscriptionId, committed ? 'own' : null); assert.equal(result.workoutNotificationMode, null)
    assert.deepEqual(result.warnings, ['push_registration_unconfirmed'])
    assert.ok(!f.calls.includes('unsubscribe') && !f.calls.includes('remove'))
    await f.controller.inspect(); assert.deepEqual(modes, [mode])
    let signs = 0
    await logoutWithPushCleanup({ cleanup: f.controller.disable, signOut: async () => { signs++; return {} } })
    assert.equal(signs, 1); assert.equal(f.records.size, 0)
  })
}

test('timeout aborts one atomic write; failed reconciliation invents no binding or mode', async () => {
  const f = fixture(2); let count = 0, signal
  f.api.registerWithMode = (_value, _mode, incoming) => { signal = incoming; count++; return new Promise(() => {}) }
  f.api.lookup = async () => { throw Error('offline') }
  const result = await f.controller.enable()
  assert.equal(count, 1); assert.equal(signal.aborted, true)
  assert.equal(result.error, 'push_registration_unconfirmed'); assert.equal(result.subscriptionId, null)
  assert.equal(result.workoutNotificationMode, null)
  assert.ok(!f.calls.includes('unsubscribe') && !f.calls.includes('remove'))
})

test('explicit repeated activation applies mode atomically and reuses native subscription', async () => {
  const f = fixture(2)
  await f.controller.enable(); f.browser.Notification.maxActions = 0
  const result = await f.controller.enable()
  assert.equal(result.subscriptionId, 'own'); assert.equal(result.workoutNotificationMode, 'minimal')
  assert.equal(f.records.get('own'), 'minimal')
  assert.deepEqual(f.calls.filter(Array.isArray), [['register', 'enhanced'], ['register', 'minimal']])
  assert.equal(f.calls.filter((call) => call === 'subscribe').length, 1)
})

test('denied permission and definite DB rejection keep prior cleanup behavior', async () => {
  const denied = fixture(2); denied.browser.Notification.permission = 'denied'
  await denied.controller.enable(); assert.deepEqual(denied.calls, [])
  const rejected = fixture(2)
  rejected.api.registerWithMode = async () => { throw Object.assign(Error('rejected'), { registrationRejected: true }) }
  await assert.rejects(rejected.controller.enable(), /rejected/)
  assert.ok(rejected.calls.includes('unsubscribe'))
})

test('logout during atomic registration cannot reactivate the binding', async () => {
  const f = fixture(2); let entered, release
  const started = new Promise((resolve) => { entered = resolve })
  f.api.registerWithMode = () => new Promise((resolve) => { release = () => { f.records.set('own', 'enhanced'); resolve('own') }; entered() })
  const activation = f.controller.enable(); await started
  await f.controller.disable(); release()
  await assert.rejects(activation, /activation_cancelled/); assert.equal(f.records.size, 0)
})

test('SDK port disables retries and sends only the atomic RPC with detected mode', async () => {
  const calls = [], id = '11111111-1111-4111-8111-111111111111', signal = new AbortController().signal
  const value = { endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic', p256dh: key, auth: 'synthetic' }
  const chain = { retry: (enabled) => { calls.push(['retry', enabled]); return chain },
    abortSignal: (incoming) => { assert.equal(incoming, signal); return chain },
    then: (resolve, reject) => Promise.resolve({ data: id, error: null, status: 200 }).then(resolve, reject) }
  const client = { rpc: (name, args) => { calls.push([name, args]); return chain } }
  assert.equal(await registerPushWithMode(client, value, 'minimal', signal), id)
  assert.deepEqual(calls, [['registrar_push_subscription_com_modo', { p_endpoint: value.endpoint, p_p256dh: key,
    p_auth: 'synthetic', p_workout_notification_mode: 'minimal' }], ['retry', false]])
})

test('SDK port distinguishes SQL rejection from ambiguous gateway/network failure, without leaking details', async () => {
  for (const [status, code, rejected] of [[400, '23514', true], [403, '42501', true], [0, '', false], [502, 'gateway', false]]) {
    const chain = { retry: () => chain, then: (resolve, reject) => Promise.resolve({ status, error: { code, message: 'sensitive' } }).then(resolve, reject) }
    await assert.rejects(registerPushWithMode({ rpc: () => chain }, {}, 'enhanced'), (error) =>
      error.message === 'push_backend_failed' && error.registrationRejected === rejected)
  }
})

test('D inspection never synchronizes, creates, or requests permission; activation sends its mode once', async () => {
  for (const value of [undefined, 0, 1, 2, 3, -1, '3']) {
    const f = fixture(value)
    await f.controller.inspect(); assert.deepEqual(f.calls, [])
    const result = await f.controller.enable()
    const mode = workoutNotificationMode(f.browser)
    assert.equal(result.workoutNotificationMode, mode); assert.equal(f.records.get('own'), mode)
    assert.deepEqual(f.calls, ['permission', 'worker', 'subscribe', ['register', mode]])
    f.calls.length = 0; await f.controller.inspect(); assert.deepEqual(f.calls, ['lookup'])
  }
})

test('D repeated binding with a lost response preserves subscription without inventing a confirmed mode', async () => {
  const f = fixture(3)
  await f.controller.enable(); assert.equal(f.records.get('own'), 'enhanced')
  f.api.registerWithMode = async () => { throw Error('private backend details') }
  const result = await f.controller.enable()
  assert.equal(result.status, 'error'); assert.equal(result.workoutNotificationMode, null)
  assert.equal(f.records.get('own'), 'enhanced'); assert.deepEqual(result.warnings, ['push_registration_unconfirmed'])
  assert.equal(f.calls.filter((call) => call === 'subscribe').length, 1)
  assert.ok(!f.calls.includes('unsubscribe'))
  assert.equal((await f.controller.inspect()).subscriptionId, 'own')
})

test('D atomic timeout sends no compensation, reports ambiguity and never prevents logout', async () => {
  const f = fixture(2); let count = 0, signal, signs = 0
  f.api.registerWithMode = (_value, _mode, incoming) => { signal = incoming; count++; return new Promise(() => {}) }
  const result = await f.controller.enable()
  assert.equal(count, 1); assert.equal(signal.aborted, true)
  assert.equal(result.workoutNotificationMode, null); assert.equal(result.status, 'error')
  assert.deepEqual(result.warnings, ['push_registration_unconfirmed'])
  await logoutWithPushCleanup({ cleanup: f.controller.disable, signOut: async () => { signs++; return {} } })
  assert.equal(signs, 1); assert.equal(f.records.size, 0)
})

test('D minimal response lost after commit cannot enable enhanced or cause any second write', async () => {
  const f = fixture(0), modes = []
  f.api.registerWithMode = async (_value, mode) => {
    modes.push(mode); f.records.set('own', mode)
    throw Error('response_lost_after_commit')
  }
  const result = await f.controller.enable()
  assert.deepEqual(modes, ['minimal'])
  assert.equal(f.records.get('own'), 'minimal'); assert.equal(result.workoutNotificationMode, null)
  assert.deepEqual(result.warnings, ['push_registration_unconfirmed'])
})

test('D denied permission and definite registration rejection never invoke a setter', async () => {
  const denied = fixture(2); denied.browser.Notification.permission = 'denied'
  await denied.controller.enable(); assert.deepEqual(denied.calls, [])
  const failed = fixture(2); failed.api.registerWithMode = async () => { throw Object.assign(Error('rejected'), { registrationRejected: true }) }
  await assert.rejects(failed.controller.enable()); assert.ok(failed.calls.includes('unsubscribe'))
  assert.ok(!failed.calls.some(Array.isArray))
})

test('D logout during atomic registration cancels activation and removes binding without reactivation', async () => {
  const f = fixture(2); let entered, release
  const started = new Promise((resolve) => { entered = resolve })
  f.api.registerWithMode = () => new Promise((resolve) => { release = () => resolve('own'); entered() })
  const activation = f.controller.enable(); await started
  await f.controller.disable(); release()
  await assert.rejects(activation, /activation_cancelled/)
  assert.equal(f.records.size, 0); assert.equal((await f.controller.inspect()).status, 'granted')
})
