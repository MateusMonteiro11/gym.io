import test from 'node:test'
import assert from 'node:assert/strict'
import { createPushHandler, TEST_PAYLOAD, validatePushEndpoint } from './pushHandler.js'

const ID = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
function setup(status = 201) {
  const calls = []; let row = { id: ID, id_usuario: 'A', endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic', updated_at: 'one' }
  let claimed = false
  const repository = {
    get: async (uid, id) => { calls.push(['get', uid, id]); return uid === row?.id_usuario && id === row.id ? row : null },
    claim: async (uid, id) => { if (claimed || uid !== row?.id_usuario || id !== row.id) return null; claimed = true; return { ...row } },
    removeSnapshot: async (uid, snapshot) => { if (uid === row?.id_usuario && snapshot.updated_at === row.updated_at) { row = null; calls.push(['delete', uid]); return true } return false },
  }
  let transport = async (snapshot, payload) => { calls.push(['send', snapshot.id_usuario, payload]); return status }
  const handler = createPushHandler({ authenticate: async (jwt) => jwt === 'valid-A' ? { id: 'A' } : jwt === 'valid-B' ? { id: 'B' } : null,
    repository, sendPush: (...args) => transport(...args), allowedOrigins: ['http://localhost:5173'] })
  const invoke = (jwt = 'valid-A', body = { subscription_id: ID }, extra = {}) => handler(new Request('http://localhost/functions/v1/push-test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), ...extra }, body: JSON.stringify(body),
  }))
  return { invoke, handler, calls, get row() { return row }, set transport(value) { transport = value }, rotate: () => { row.updated_at = 'two' } }
}

test('authentication is required before any repository access', async () => {
  const s = setup()
  for (const jwt of [null, 'bad']) assert.equal((await s.invoke(jwt)).status, 401)
  assert.deepEqual(s.calls, [])
})
test('caller cannot send to another owner or choose endpoint, identity or payload', async () => {
  const s = setup()
  assert.equal((await s.invoke('valid-B')).status, 404)
  assert.equal((await s.invoke('valid-A', { subscription_id: OTHER })).status, 404)
  for (const extra of [{ endpoint: 'https://evil.example/' }, { id_usuario: 'B' }, { payload: TEST_PAYLOAD }]) {
    assert.equal((await s.invoke('valid-A', { subscription_id: ID, ...extra })).status, 400)
  }
  assert.ok(!s.calls.some((c) => c[0] === 'send'))
})
test('success sends fixed payload for verified owner; repeat is rate limited', async () => {
  const s = setup()
  assert.deepEqual(await (await s.invoke()).json(), { result: 'sent' })
  assert.deepEqual(s.calls.find((c) => c[0] === 'send'), ['send', 'A', TEST_PAYLOAD])
  assert.equal((await s.invoke()).status, 429)
  assert.ok(s.row)
})
for (const status of [404, 410]) test(`provider ${status} cleans only selected owned subscription`, async () => {
  const s = setup(status)
  assert.deepEqual(await (await s.invoke()).json(), { result: 'expired' }); assert.equal(s.row, null)
})
test('temporary errors and transport exceptions retain subscriptions without leaking provider error', async () => {
  for (const status of [403, 429, 500, 503]) { const s = setup(status); assert.equal((await s.invoke()).status, 503); assert.ok(s.row) }
  const s = setup(); s.transport = async () => { throw new Error('secret endpoint credentials') }
  const response = await s.invoke(); assert.equal(response.status, 503); assert.equal(await response.text(), '{"result":"temporarily_unavailable"}'); assert.ok(s.row)
})
test('expired response cannot delete a concurrently refreshed record', async () => {
  const s = setup(); s.transport = async () => { s.rotate(); return 410 }
  assert.deepEqual(await (await s.invoke()).json(), { result: 'subscription_changed' }); assert.ok(s.row)
})
test('concurrent test requests send only once', async () => {
  const s = setup(); const results = await Promise.all([s.invoke(), s.invoke()])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 429]); assert.equal(s.calls.filter((c) => c[0] === 'send').length, 1)
})
test('endpoint validation rejects SSRF destinations, credentials, ports, fragments and redirects destinations', () => {
  for (const url of ['http://fcm.googleapis.com/path', 'https://127.0.0.1/path', 'https://fcm.googleapis.com.evil.example/path',
    'https://u:p@fcm.googleapis.com/path', 'https://fcm.googleapis.com:123/path', 'https://fcm.googleapis.com/path#fragment']) assert.equal(validatePushEndpoint(url), false)
  for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']) assert.equal(validatePushEndpoint(`https://${host}/push/test`), true)
})
test('CORS is explicit and malformed/oversized bodies fail closed', async () => {
  const s = setup()
  assert.equal((await s.invoke('valid-A', { subscription_id: ID }, { Origin: 'https://evil.example' })).status, 403)
  assert.equal((await s.invoke('valid-A', { subscription_id: 'x'.repeat(2048) })).status, 400)
  const options = await s.handler(new Request('http://localhost/', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }))
  assert.equal(options.status, 204); assert.equal(options.headers.get('access-control-allow-origin'), 'http://localhost:5173')
})
