// Disposable local harness. Fixed test groups keep each request within runtime limits.
import { createClient } from 'npm:@supabase/supabase-js@2.106.0'
import { createPushHandler, TEST_PAYLOAD, validatePushEndpoint } from '../_shared/pushHandler.js'
import { createPushRepository } from '../_shared/pushRepository.js'
import { createWebPushTransport } from '../_shared/pushTransport.js'
import { createPushAdminClient } from '../_shared/pushAdminClient.js'

const url = Deno.env.get('SUPABASE_URL')!
const host = new URL(url)
if (host.protocol !== 'http:' || !['kong', 'localhost', '127.0.0.1'].includes(host.hostname)) throw new Error('local_harness_only')
const { client: admin } = createPushAdminClient({ createClient, env: (name: string) => Deno.env.get(name) })
const tokenA = Deno.env.get('PUSH_TEST_A_JWT')!
const tokenB = Deno.env.get('PUSH_TEST_B_JWT')!
const a = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${tokenA}` } }, auth: { persistSession: false, autoRefreshToken: false } })
const authenticate = async (jwt: string) => {
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) throw new Error('authentication_required')
  return data.user
}
const check = (condition: unknown, label: string) => { if (!condition) throw new Error(label) }
const b64 = (v: Uint8Array) => btoa(String.fromCharCode(...v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const groups = ['core', 'transport', 'expiration', 'temporary', 'timeout', 'concurrency', 'refresh', 'credentials']

Deno.serve(async (request) => {
  const ids: string[] = []
  try {
    const userA = await authenticate(tokenA)
    const caller = await authenticate(request.headers.get('authorization')?.replace(/^Bearer /i, '') ?? '')
    if (caller.id !== userA.id) return Response.json({ passed: false }, { status: 403 })
    const { group } = await request.json()
    if (!groups.includes(group)) return Response.json({ passed: false }, { status: 400 })
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const p256dh = b64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)))
    const auth = b64(crypto.getRandomValues(new Uint8Array(16)))
    const register = async (suffix: string) => {
      const { data, error } = await a.rpc('registrar_push_subscription', {
        p_endpoint: `https://fcm.googleapis.com/fcm/send/edge-${suffix}-${crypto.randomUUID()}`, p_p256dh: p256dh, p_auth: auth,
      })
      check(!error && data, 'registration'); ids.push(data); return data as string
    }
    const repository = createPushRepository(admin)
    const requestFor = (id: string, jwt: string | null = tokenA, extra = {}) => new Request('http://localhost/push-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: JSON.stringify({ subscription_id: id, ...extra }),
    })
    let sends = 0
    let encryptedBytes = 0
    const create = (transport: (...args: any[]) => Promise<number>) => createPushHandler({ authenticate, repository,
      sendPush: async (snapshot: any, payload: any) => {
        check(snapshot.id_usuario === userA.id, 'send_owner')
        check(JSON.stringify(payload) === JSON.stringify(TEST_PAYLOAD), 'payload')
        sends++; return transport(snapshot, payload)
      }, allowedOrigins: ['http://localhost:5173'] })
    const verified: string[] = []
    const success = create(async () => 201)
    if (group === 'credentials') {
      const id = await register(group)
      for (const modern of [true, false]) {
        let adminRequests = 0
        let callerJWTs = 0
        const env = (name: string) => name === 'SUPABASE_SECRET_KEYS'
          ? (modern ? JSON.stringify({ default: Deno.env.get('PUSH_TEST_SECRET_KEY') }) : undefined) : Deno.env.get(name)
        const { client, credentialKind } = createPushAdminClient({ createClient, env,
          fetchImpl: async (input: any, init: any) => {
            const headers = new Headers(init.headers)
            check(!/^Bearer sb_secret_/i.test(headers.get('authorization') ?? ''), 'secret_not_bearer')
            if (new URL(String(input)).pathname.startsWith('/auth/')) {
              check(headers.get('authorization') === `Bearer ${tokenA}`, 'caller_jwt_preserved'); callerJWTs++
            } else {
              check(Boolean(headers.get('apikey')), 'admin_apikey'); adminRequests++
            }
            return fetch(input, init)
          } })
        check(credentialKind === (modern ? 'secret_key' : 'legacy_service_role'), 'credential_selection')
        const { data, error } = await client.auth.getUser(tokenA)
        check(!error && data.user?.id === userA.id, 'credential_auth')
        check(Boolean(await createPushRepository(client).get(userA.id, id)), 'credential_admin_select')
        check(callerJWTs === 1 && adminRequests === 1, 'credential_requests')
        verified.push(modern ? 'modern_secret_key' : 'legacy_service_role')
      }
      verified.push('secret_not_bearer')
    } else if (group === 'core') {
      const id = await register(group)
      const forbiddenOrigin = requestFor(id)
      forbiddenOrigin.headers.set('origin', 'https://untrusted.local.invalid')
      check((await success(forbiddenOrigin)).status === 403 && sends === 0, 'CORS')
      const options = await success(new Request('http://localhost/push-test', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }))
      check(options.status === 204 && options.headers.get('access-control-allow-origin') === 'http://localhost:5173', 'CORS_preflight')
      for (const destination of ['http://fcm.googleapis.com/path', 'https://127.0.0.1/path', 'https://fcm.googleapis.com.evil.invalid/path',
        'https://user:password@fcm.googleapis.com/path', 'https://fcm.googleapis.com:8443/path', 'https://fcm.googleapis.com/path#fragment']) {
        check(!validatePushEndpoint(destination), 'SSRF')
      }
      check((await success(requestFor(id, null))).status === 401, 'no_jwt')
      check((await success(requestFor(id, 'invalid-jwt'))).status === 401, 'invalid_jwt')
      check((await success(requestFor(id, tokenB))).status === 404, 'other_user')
      check((await success(requestFor(id, tokenA, { id_usuario: userA.id }))).status === 400, 'arbitrary_identity')
      check((await success(requestFor(id, tokenA, { endpoint: 'https://untrusted.local.invalid/' }))).status === 400, 'arbitrary_endpoint')
      check((await success(requestFor(id, tokenA, { payload: {} }))).status === 400, 'arbitrary_payload')
      check((await success(requestFor(id))).status === 200, 'success')
      check((await success(requestFor(id))).status === 429, 'rate_limit')
      check(sends === 1, 'single_send')
      verified.push('JWT', 'ownership', 'payload', 'success', 'rate_limit', 'CORS', 'SSRF')
    } else if (group === 'transport' || group === 'timeout') {
      const { default: webpush } = await import('npm:web-push@3.6.7')
      const vapid = { publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!, privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!, subject: Deno.env.get('VAPID_SUBJECT')! }
      const transport = createWebPushTransport({ generateRequestDetails: webpush.generateRequestDetails.bind(webpush), vapid,
        fetchImpl: group === 'timeout' ? () => new Promise(() => {}) : async (_destination: string, options: any) => {
          check(options.method === 'POST' && options.redirect === 'error', 'transport_options')
          check(options.headers.TTL === 60 || options.headers.TTL === '60', 'transport_ttl')
          check(Boolean(options.headers.Authorization), 'transport_vapid')
          encryptedBytes = options.body.byteLength
          check(encryptedBytes > 150, 'encrypted_body')
          return new Response(null, { status: 201 })
        }, timeoutMs: group === 'timeout' ? 20 : 10000 })
      const id = await register(group)
      check((await create(transport)(requestFor(id))).status === (group === 'timeout' ? 503 : 200), 'transport_result')
      check(Boolean(await repository.get(userA.id, id)), 'transport_record_preserved')
      verified.push(group === 'timeout' ? 'transport_timeout' : 'encrypted_transport')
    } else if (group === 'expiration') {
      for (const status of [404, 410]) {
        const id = await register(String(status))
        check((await (await create(async () => status)(requestFor(id))).json()).result === 'expired', `provider_${status}`)
        check(await repository.get(userA.id, id) === null, `cleanup_${status}`)
        verified.push(String(status))
      }
    } else if (group === 'temporary') {
      for (const status of [429, 503]) {
        const id = await register(String(status))
        check((await create(async () => status)(requestFor(id))).status === 503, `temporary_${status}`)
        check(Boolean(await repository.get(userA.id, id)), 'retained_temporary')
      }
      verified.push('temporary_error')
    } else if (group === 'concurrency') {
      const id = await register(group)
      const responses = await Promise.all([success(requestFor(id)), success(requestFor(id))])
      check(responses.map((response) => response.status).sort().join(',') === '200,429' && sends === 1, 'atomic_rate_limit')
      const { error } = await admin.from('push_subscriptions').update({ last_test_requested_at: new Date(Date.now() - 31000).toISOString() })
        .eq('id', id).eq('id_usuario', userA.id)
      check(!error, 'cooldown_fixture')
      check((await success(requestFor(id))).status === 200 && sends === 2, 'cooldown_elapsed')
      verified.push('atomic_rate_limit')
    } else if (group === 'refresh') {
      const id = await register(group)
      const response = await create(async (snapshot: any) => {
        const { error } = await a.rpc('registrar_push_subscription', { p_endpoint: snapshot.endpoint, p_p256dh: p256dh,
          p_auth: b64(crypto.getRandomValues(new Uint8Array(16))) })
        check(!error, 'refresh'); return 410
      })(requestFor(id))
      check((await response.json()).result === 'subscription_changed', 'stale_cleanup_rejected')
      check(Boolean(await repository.get(userA.id, id)), 'refreshed_subscription_preserved')
      verified.push('concurrent_refresh')
    }
    return Response.json({ passed: true, group, runtime: Deno.version, externalPushRequests: 0, encryptedBytes, verified })
  } catch (error) {
    const label = error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'harness_failed'
    return Response.json({ passed: false, check: label }, { status: 500 })
  } finally {
    for (const id of ids) await a.rpc('remover_push_subscription', { p_subscription_id: id })
  }
})
