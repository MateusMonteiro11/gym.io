// Run from repository root; refuses production endpoints and changed historical SQL.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash, createECDH, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const runtime = path.resolve('supabase/.runtime')
const container = 'supabase_db_gymio-push-foundation-local'
const expected = {
  '20260725194232_auth_email_security.sql': 'cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6',
  '20260821190134_workout_session_persistence_expand.sql': '6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db',
  '20260823003337_exercise_memory_read.sql': '7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02',
}
for (const [name, hash] of Object.entries(expected)) assert.equal(createHash('sha256').update(fs.readFileSync(`supabase/migrations/${name}`)).digest('hex'), hash, `historical hash ${name}`)
fs.mkdirSync(runtime, { recursive: true })
const stage = process.argv[2]
const sql = (text) => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
const status = JSON.parse(fs.readFileSync(path.join(runtime, 'status.json'), 'utf8').replace(/^\uFEFF/, ''))
const apiUrl = status.API_URL ?? status.api_url
assert.ok(['localhost', '127.0.0.1'].includes(new URL(apiUrl).hostname), 'local API only')
assert.equal(new URL(apiUrl).port, '55431', 'isolated port')
const anon = status.ANON_KEY ?? status.anon_key
assert.ok(anon, 'local anon key missing')
const json = async (url, jwt, body, method = 'POST') => {
  assert.equal(new URL(url).origin, new URL(apiUrl).origin)
  const response = await fetch(url, { method, headers: { apikey: anon, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) })
  const text = await response.text()
  let data; try { data = text ? JSON.parse(text) : null } catch { data = null }
  return { status: response.status, data }
}

if (stage === 'credentials') {
  assert.ok(!fs.existsSync('.env.push.local'), 'preserve existing local env file')
  const users = []
  for (const letter of ['a', 'b']) {
    const password = randomBytes(24).toString('base64url') + 'A1!'
    const email = `push-${letter}-${Date.now()}@local.invalid`
    const result = await json(`${apiUrl}/auth/v1/signup`, null, { email, password })
    assert.equal(result.status, 200, 'local signup')
    assert.ok(result.data.access_token, 'local signup session')
    users.push({ id: result.data.user.id, jwt: result.data.access_token, email, password })
  }
  const vapid = createECDH('prime256v1'); vapid.generateKeys()
  fs.writeFileSync(path.join(runtime, 'users.json'), JSON.stringify(users))
  const secret = status.SECRET_KEY ?? status.secret_key
  assert.ok(secret?.startsWith('sb_secret_'), 'local modern secret key missing')
  fs.writeFileSync(path.join(runtime, 'edge.env'), `PUSH_ALLOWED_ORIGINS=http://localhost:5173\nPUSH_TEST_A_JWT=${users[0].jwt}\nPUSH_TEST_B_JWT=${users[1].jwt}\nPUSH_TEST_SECRET_KEY=${secret}\nVAPID_PUBLIC_KEY=${vapid.getPublicKey().toString('base64url')}\nVAPID_PRIVATE_KEY=${vapid.getPrivateKey().toString('base64url')}\nVAPID_SUBJECT=mailto:local-test@gym.io\n`)
  // Vite receives only local public values; the existing .env remains untouched.
  fs.writeFileSync('.env.push.local', `VITE_SUPABASE_URL=${apiUrl}\nVITE_SUPABASE_PUBLISHABLE_KEY=${anon}\nVITE_VAPID_PUBLIC_KEY=${vapid.getPublicKey().toString('base64url')}\n`)
  console.log('PASS local synthetic users / isolated credentials (no secret output)')
} else if (stage === 'bootstrap') {
  assert.match(sql("select to_regclass('public.push_subscriptions') is null and to_regclass('public.treino_sessoes') is null as fresh;"), /t/)
  sql(fs.readFileSync('supabase/testing/legacy-baseline.sql', 'utf8'))
  for (const name of ['20260821190134_workout_session_persistence_expand.sql', '20260823003337_exercise_memory_read.sql']) sql('begin;\n' + fs.readFileSync(`supabase/migrations/${name}`, 'utf8') + '\ncommit;')
  const migrations = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('_push_foundation.sql'))
  assert.equal(migrations.length, 1)
  sql(fs.readFileSync(`supabase/migrations/${migrations[0]}`, 'utf8'))
  const users = JSON.parse(fs.readFileSync(path.join(runtime, 'users.json'), 'utf8'))
  const literal = (value) => "'" + String(value).replace(/'/g, "''") + "'"
  for (const user of users) {
    assert.ok(user.email.endsWith('@local.invalid'))
    sql(`insert into public.usuarios(id_usuario,nome,email,status) values(${literal(user.id)}::uuid,'Push local',${literal(user.email)},'ativo');`)
  }
  sql("notify pgrst, 'reload schema';")
  console.log('PASS support baseline + complete EXPAND + Memory + Push migration/assertions')
} else if (stage === 'sql') {
  const result = sql(fs.readFileSync('supabase/testing/push-security.sql', 'utf8'))
  assert.match(result, /ROLLBACK/)
  const migration = fs.readdirSync('supabase/migrations').find((name) => name.endsWith('_push_foundation.sql'))
  const assertions = fs.readFileSync(`supabase/migrations/${migration}`, 'utf8').match(/do \$assertions\$[\s\S]*?\$assertions\$;/)?.[0]
  assert.ok(assertions, 'actual migration assertions')
  sql(assertions) // Audit real baseline first. Never revoke unexpected real ACLs.
  for (const grant of ['select on public.usuarios', 'select(nome) on public.usuarios',
    'insert(nome) on public.usuarios', 'update(nome) on public.usuarios', 'references(nome) on public.usuarios',
    'truncate on public.push_subscriptions', 'references(endpoint) on public.push_subscriptions']) {
    // Deliberate negative fixtures live only in a transaction. The failing
    // connection rolls them back; no historical ACL is repaired or revoked.
    assert.throws(() => sql(`begin; grant ${grant} to gymio_push_executor;\n${assertions}\nrollback;`),
      (error) => String(error.stderr).includes('push executor relation allowlist violation'), `reject ${grant}`)
    sql(assertions)
  }
  console.log('PASS executor relation allowlist: real baseline + seven rolled-back negative ACL fixtures')
  console.log('PASS SQL security, ownership, constraints, grants, identity formats and lifecycle')
} else {
  const [a, b] = JSON.parse(fs.readFileSync(path.join(runtime, 'users.json'), 'utf8'))
  if (stage === 'ready') {
    const deadline = Date.now() + 60000
    let ready = false
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${apiUrl}/functions/v1/push-test`, { method: 'OPTIONS', headers: { apikey: anon }, signal: AbortSignal.timeout(5000) })
        ready = response.status === 204
        await response.body?.cancel()
        if (ready) break
      } catch { /* Only startup availability is retried; test failures are never retried. */ }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    assert.ok(ready, 'local Edge Runtime readiness')
    console.log('PASS local Edge Runtime readiness')
  } else if (stage === 'spike') {
    const result = await json(`${apiUrl}/functions/v1/push-compat-spike`, a.jwt, {})
    assert.equal(result.status, 200, 'real Edge Runtime compatibility spike')
    assert.equal(result.data.imported, true); assert.equal(result.data.method, 'POST'); assert.ok(result.data.encryptedBytes > 150)
    assert.equal(result.data.contentEncoding, 'aes128gcm'); assert.equal(result.data.hasAuthorization, true); assert.equal(result.data.transmitted, false)
    fs.writeFileSync(path.join(runtime, 'spike-result.json'), JSON.stringify(result.data, null, 2))
    console.log(JSON.stringify(result.data))
  } else if (stage === 'data-api') {
    const key = createECDH('prime256v1'); key.generateKeys()
    const p256dh = key.getPublicKey().toString('base64url'), auth = randomBytes(16).toString('base64url')
    const endpoint = 'https://fcm.googleapis.com/fcm/send/api-a'
    const args = { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth }
    const rpc = (name, jwt, body) => json(`${apiUrl}/rest/v1/rpc/${name}`, jwt, body)
    const registered = await rpc('registrar_push_subscription', a.jwt, args)
    assert.equal(registered.status, 200); const id = registered.data
    assert.equal((await rpc('registrar_push_subscription', a.jwt, args)).data, id)
    const second = await rpc('registrar_push_subscription', a.jwt, { ...args, p_endpoint: endpoint + '-second' }); assert.equal(second.status, 200); assert.notEqual(second.data, id)
    assert.equal((await rpc('consultar_push_subscription', b.jwt, { p_endpoint: endpoint })).data, null)
    assert.equal((await rpc('remover_push_subscription', b.jwt, { p_subscription_id: id })).status, 204)
    assert.equal((await rpc('consultar_push_subscription', a.jwt, { p_endpoint: endpoint })).data, id)
    assert.ok((await rpc('registrar_push_subscription', b.jwt, args)).status >= 400)
    for (const jwt of [a.jwt, b.jwt, null]) for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      const filter = method === 'PATCH' || method === 'DELETE' ? `?id=eq.${id}` : ''
      const value = method === 'POST' ? { id_usuario: a.id, endpoint: endpoint + '-direct', p256dh, auth } : method === 'PATCH' ? { auth } : undefined
      const result = await json(`${apiUrl}/rest/v1/push_subscriptions${filter}`, jwt, value, method)
      assert.ok(result.status === 401 || result.status === 403, `direct ${method} blocked`)
    }
    assert.ok((await rpc('registrar_push_subscription', null, args)).status >= 400)
    assert.equal((await rpc('registrar_push_subscription', 'invalid-jwt', args)).status, 401)
    const concurrent = await Promise.all([rpc('registrar_push_subscription', a.jwt, { ...args, p_endpoint: endpoint + '-race' }), rpc('registrar_push_subscription', a.jwt, { ...args, p_endpoint: endpoint + '-race' })])
    assert.ok(concurrent.every((r) => r.status === 200)); assert.equal(concurrent[0].data, concurrent[1].data)
    for (let i = 0; i < 2; i++) assert.equal((await rpc('remover_push_subscription', a.jwt, { p_subscription_id: id })).status, 204)
    assert.equal((await rpc('consultar_push_subscription', a.jwt, { p_endpoint: endpoint })).data, null)
    fs.writeFileSync(path.join(runtime, 'api-result.json'), JSON.stringify({ passed: true, verified: ['JWT', 'multiple_devices', 'idempotence', 'concurrency', 'ownership', 'DML_blocked'] }))
    console.log('PASS Data API: JWT, multiple devices, idempotence, concurrent registration, ownership and blocked DML')
  } else if (stage === 'edge') {
    for (const jwt of [null, 'invalid-jwt']) {
      const result = await json(`${apiUrl}/functions/v1/push-test`, jwt, { subscription_id: '11111111-1111-4111-8111-111111111111' })
      assert.equal(result.status, 401)
    }
    assert.equal((await json(`${apiUrl}/functions/v1/push-test`, a.jwt, { subscription_id: '11111111-1111-4111-8111-111111111111' })).status, 404)
    const results = []
    for (const group of ['core', 'transport', 'expiration', 'temporary', 'timeout', 'concurrency', 'refresh', 'credentials']) {
      const result = await json(`${apiUrl}/functions/v1/push-integration`, a.jwt, { group })
      assert.equal(result.status, 200, `real Edge Runtime group ${group}`)
      assert.equal(result.data.passed, true)
      assert.equal(result.data.externalPushRequests, 0)
      if (group === 'transport') assert.ok(result.data.encryptedBytes > 150)
      results.push(result.data)
      console.log(`PASS real Edge Runtime group: ${group}`)
    }
    const verified = [...new Set(results.flatMap((result) => result.verified))]
    for (const required of ['JWT','ownership','payload','success','rate_limit','CORS','SSRF','encrypted_transport','404','410','temporary_error','transport_timeout','atomic_rate_limit','concurrent_refresh','modern_secret_key','legacy_service_role','secret_not_bearer']) assert.ok(verified.includes(required), `required Edge coverage: ${required}`)
    const result = { passed: true, runtime: results[0].runtime, externalPushRequests: 0, encryptedBytes: results.find((result) => result.group === 'transport').encryptedBytes, verified }
    fs.writeFileSync(path.join(runtime, 'edge-result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } else throw new Error('unknown local test stage')
}
