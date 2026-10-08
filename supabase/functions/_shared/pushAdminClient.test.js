import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createPushAdminClient } from './pushAdminClient.js'

const legacy = 'synthetic.service.role'
const secret = 'sb_secret_synthetic_local_only'
const caller = 'synthetic.user.jwt'
const url = 'http://localhost:55431'

test('actual SDK uses modern apikey without secret Bearer and preserves the caller JWT for Auth', async () => {
  const requests = []
  const { client, credentialKind } = createPushAdminClient({ createClient,
    env: (name) => ({ SUPABASE_URL: url, SUPABASE_SECRET_KEYS: JSON.stringify({ default: secret }), SUPABASE_SERVICE_ROLE_KEY: legacy })[name],
    fetchImpl: async (input, options) => {
      const headers = new Headers(options.headers)
      assert.equal(headers.get('apikey'), secret)
      assert.ok(!/^Bearer sb_secret_/.test(headers.get('authorization') ?? ''))
      assert.equal(options.redirect, 'error')
      requests.push({ url: String(input), authorization: headers.get('authorization') })
      return Response.json(String(input).includes('/auth/') ? { id: 'own-user' } : [])
    } })
  assert.equal(credentialKind, 'secret_key')
  assert.equal((await client.auth.getUser(caller)).data.user.id, 'own-user')
  assert.equal((await client.from('push_subscriptions').select('id').eq('id_usuario', 'own-user')).error, null)
  assert.equal(requests[0].authorization, `Bearer ${caller}`)
  assert.equal(requests[1].authorization, null)
})

test('absent modern default uses the documented legacy service-role fallback', async () => {
  for (const encoded of [undefined, '{}', JSON.stringify({ another: secret })]) {
    const { client, credentialKind } = createPushAdminClient({ createClient,
      env: (name) => ({ SUPABASE_URL: url, SUPABASE_SECRET_KEYS: encoded, SUPABASE_SERVICE_ROLE_KEY: legacy })[name],
      fetchImpl: async (_input, options) => {
        assert.equal(new Headers(options.headers).get('apikey'), legacy)
        assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${legacy}`)
        return Response.json([])
      } })
    assert.equal(credentialKind, 'legacy_service_role')
    assert.equal((await client.from('push_subscriptions').select('id')).error, null)
  }
})

test('malformed configured modern keys fail closed instead of silently falling back', () => {
  for (const encoded of ['{bad', 'null', '[]', '{"default":null}', '{"default":"raw-private-secret"}']) {
    let requests = 0
    assert.throws(() => createPushAdminClient({ createClient,
      env: (name) => ({ SUPABASE_URL: url, SUPABASE_SECRET_KEYS: encoded, SUPABASE_SERVICE_ROLE_KEY: legacy })[name],
      fetchImpl: () => { requests++; throw new Error('unexpected') } }), /push_server_credentials_invalid/)
    assert.equal(requests, 0)
  }
})
