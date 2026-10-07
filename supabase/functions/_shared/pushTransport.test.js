import test from 'node:test'
import assert from 'node:assert/strict'
import { createWebPushTransport } from './pushTransport.js'
import { TEST_PAYLOAD } from './pushHandler.js'

const snapshot = { endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic', p256dh: 'synthetic-key', auth: 'synthetic-auth' }
const generator = (subscription) => ({ endpoint: subscription.endpoint, method: 'POST', headers: { 'Content-Encoding': 'aes128gcm' }, body: new Uint8Array([1, 2, 3]) })
test('transport uses only generated encrypted request, fixed TTL and forbids redirects', async () => {
  let call
  const send = createWebPushTransport({ vapid: {}, generateRequestDetails: (subscription, payload, options) => {
    assert.equal(subscription.endpoint, snapshot.endpoint); assert.equal(payload, JSON.stringify(TEST_PAYLOAD)); assert.equal(options.TTL, 60); return generator(subscription)
  }, fetchImpl: async (url, options) => { call = { url, options }; return new Response('', { status: 201 }) } })
  assert.equal(await send(snapshot, TEST_PAYLOAD), 201)
  assert.equal(call.options.redirect, 'error'); assert.equal(call.options.method, 'POST'); assert.ok(call.options.signal)
})
test('transport timeout is bounded even when a transport does not honor abort', async () => {
  let signal
  const send = createWebPushTransport({ vapid: {}, generateRequestDetails: generator, timeoutMs: 5,
    fetchImpl: (_url, options) => { signal = options.signal; return new Promise(() => {}) } })
  await assert.rejects(send(snapshot, TEST_PAYLOAD), /push_timeout/); assert.equal(signal.aborted, true)
})
test('unsafe endpoint or generated destination substitution cannot reach fetch', async () => {
  const send = createWebPushTransport({ vapid: {}, generateRequestDetails: () => ({ ...generator(snapshot), endpoint: 'https://evil.example/' }),
    fetchImpl: () => assert.fail('network must not be called') })
  await assert.rejects(send(snapshot, TEST_PAYLOAD), /invalid_push_request/)
  await assert.rejects(send({ ...snapshot, endpoint: 'http://localhost/private' }, TEST_PAYLOAD), /provider_not_supported/)
})
