// Two real local Auth users; every mode change traverses PostgREST's JWT boundary.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createECDH, randomBytes, randomUUID } from 'node:crypto'
import { actionsContext } from './delivery-context.mjs'

const c = actionsContext(process.argv[2]), { request, users: [a, b], sql, literal: q } = c
const key = createECDH('prime256v1'); key.generateKeys()
const data = { p_endpoint: 'https://fcm.googleapis.com/fcm/send/d-api-' + randomUUID(),
  p_p256dh: key.getPublicKey().toString('base64url'), p_auth: randomBytes(16).toString('base64url') }
const cases = [], subscriptions = [], directDenials = []
const ownMode = (id) => sql(`select workout_notification_mode from public.push_subscriptions where id=${q(id)};`)
const atomicArgs = (user, mode) => ({ ...data, p_endpoint: data.p_endpoint + user.id, p_workout_notification_mode: mode })
const register = (user, mode, extra = {}) => request('/rest/v1/rpc/registrar_push_subscription_com_modo', user.jwt, { ...atomicArgs(user, mode), ...extra })
async function run(name, test) { await test(); cases.push({ name, passed: true }); console.log(`PASS D API: ${name}`) }
try {
  let id, other
  await run('existing A contract registers minimal, returning only own UUID', async () => {
    for (const user of [a, b]) {
      const result = await request('/rest/v1/rpc/registrar_push_subscription', user.jwt, { ...data, p_endpoint: data.p_endpoint + user.id })
      assert.equal(result.status, 200); assert.match(result.data, /^[0-9a-f-]{36}$/)
      subscriptions.push(result.data)
    }
    ;[id, other] = subscriptions
    assert.equal(ownMode(id), 'minimal'); assert.equal(ownMode(other), 'minimal')
  })
  await run('atomic owner registration applies each mode and preserves UUID, returning no keys', async () => {
    for (const mode of ['enhanced', 'minimal']) {
      const result = await register(a, mode)
      assert.equal(result.status, 200); assert.equal(result.data, id)
      assert.equal(ownMode(id), mode)
    }
  })
  await run('foreign endpoint collision cannot transfer ownership or modify keys/mode; UUID is not a parameter', async () => {
    const before = sql(`select to_jsonb(ps) from public.push_subscriptions ps where id=${q(other)};`)
    const foreign = await register(a, 'enhanced', { p_endpoint: data.p_endpoint + b.id })
    assert.equal(foreign.status, 403)
    assert.equal(sql(`select to_jsonb(ps) from public.push_subscriptions ps where id=${q(other)};`), before)
    for (const uuid of [id, other, randomUUID()]) {
      const extra = await register(a, 'enhanced', { p_subscription_id: uuid })
      assert.ok([400, 404].includes(extra.status))
    }
    assert.equal(ownMode(other), 'minimal')
    assert.equal(sql(`select id_usuario from public.push_subscriptions where id=${q(other)};`), b.id)
  })
  await run('invalid values rejected, mode unchanged', async () => {
    for (const mode of [null, '', 'ENHANCED', 'minimal ', 'admin']) {
      const result = await register(a, mode)
      assert.equal(result.status, 400); assert.equal(ownMode(id), 'minimal')
    }
    for (const assignment of ["null", "'admin'"]) assert.throws(() => sql(`update public.push_subscriptions set workout_notification_mode=${assignment} where id=${q(id)};`))
  })
  await run('anonymous/invalid JWT cannot invoke mode RPC', async () => {
    for (const jwt of [null, 'invalid']) {
      const result = await request('/rest/v1/rpc/registrar_push_subscription_com_modo', jwt, atomicArgs(a, 'enhanced'))
      assert.ok([401, 403].includes(result.status)); assert.equal(ownMode(id), 'minimal')
    }
  })
  await run('no direct table/column DML, endpoint/key read or private access', async () => {
    const snapshot = () => sql("select coalesce(jsonb_agg(to_jsonb(ps) order by id),'[]'::jsonb)from public.push_subscriptions ps;")
    for (const [actor, jwt, user] of [['anon', null, a], ['A', a.jwt, a], ['B', b.jwt, b]]) {
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
        const before = snapshot(), target = user === a ? id : other
        const query = method === 'GET' ? '?select=endpoint,p256dh,auth,workout_notification_mode'
          : method === 'POST' ? '' : '?id=eq.' + target
        // Valid DML must fail at the permission boundary, not because required
        // fields were omitted or the write used a read-only select projection.
        const body = method === 'POST' ? { id_usuario: user.id, endpoint: data.p_endpoint + '-forbidden-' + actor,
          p256dh: data.p_p256dh, auth: data.p_auth, workout_notification_mode: 'enhanced' }
          : method === 'PATCH' ? { workout_notification_mode: 'enhanced' } : undefined
        const result = await request('/rest/v1/push_subscriptions' + query, jwt, body, { method })
        const code = result.data?.code
        directDenials.push({ actor, method, status: result.status, code })
        assert.ok(snapshot() === before, `${actor} ${method}: forbidden direct request changed subscriptions`)
        // PostgREST may conceal an inaccessible relation from its role-specific
        // schema cache. Accept that precise denial, never arbitrary 4xx errors.
        assert.ok(([401, 403].includes(result.status) && code === '42501')
          || (result.status === 404 && code === 'PGRST205'), `${actor} ${method}: HTTP ${result.status}, code ${code}`)
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          assert.equal(sql(`select has_table_privilege(${q(jwt ? 'authenticated' : 'anon')},'public.push_subscriptions',${q(privilege)});`), 'f')
        }
      }
      const result = await request('/rest/v1/rpc/register_with_mode_impl', jwt, atomicArgs(a, 'enhanced'),
        { headers: { 'Content-Profile': 'gymio_push_private' } })
      assert.ok([401, 403, 406].includes(result.status))
    }
  })
  await run('claims GUC identity, missing/invalid identity and executor auth boundary', async () => {
    sql(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','',true);
      select set_config('request.jwt.claims',${q(JSON.stringify({ sub: a.id }))},true);
      select public.registrar_push_subscription_com_modo(${q(data.p_endpoint + a.id)},${q(data.p_p256dh)},${q(data.p_auth)},'enhanced');commit;`)
    assert.equal(ownMode(id), 'enhanced')
    for (const sub of ['', 'invalid']) assert.throws(() => sql(`begin;set local role authenticated;
      select set_config('request.jwt.claim.sub',${q(sub)},true);select set_config('request.jwt.claims','',true);
      select public.registrar_push_subscription_com_modo(${q(data.p_endpoint + a.id)},${q(data.p_p256dh)},${q(data.p_auth)},'minimal');commit;`))
    assert.equal(sql("select has_schema_privilege('gymio_push_executor','auth','USAGE') or has_schema_privilege('gymio_push_executor','auth','CREATE');"), 'f')
    const same = await request('/rest/v1/rpc/registrar_push_subscription', a.jwt, { ...data, p_endpoint: data.p_endpoint + a.id })
    assert.equal(same.status, 200); assert.equal(same.data, id); assert.equal(ownMode(id), 'minimal')
  })
  await run('A and D share original endpoint/key constraints and rollback failed changes', async () => {
    const before = sql(`select to_jsonb(ps)from public.push_subscriptions ps where id=${q(id)};`)
    for (const extra of [{ p_endpoint: 'http://invalid.local/' }, { p_p256dh: 'invalid' }, { p_auth: 'invalid' }]) {
      for (const name of ['registrar_push_subscription', 'registrar_push_subscription_com_modo']) {
        const args = { ...data, p_endpoint: data.p_endpoint + a.id, ...extra,
          ...(name.endsWith('_com_modo') ? { p_workout_notification_mode: 'enhanced' } : {}) }
        const result = await request('/rest/v1/rpc/' + name, a.jwt, args)
        assert.equal(result.status, 400)
        assert.equal(sql(`select to_jsonb(ps)from public.push_subscriptions ps where id=${q(id)};`), before)
      }
    }
  })
  await run('atomic new registration returns minimal/enhanced and updates permitted keys without changing UUID', async () => {
    for (const mode of ['minimal', 'enhanced']) {
      const args = { ...atomicArgs(a, mode), p_endpoint: data.p_endpoint + '-fresh-' + mode }
      const first = await request('/rest/v1/rpc/registrar_push_subscription_com_modo', a.jwt, args)
      assert.equal(first.status, 200); subscriptions.push(first.data); assert.equal(ownMode(first.data), mode)
      const refreshed = { ...args, p_auth: randomBytes(16).toString('base64url') }
      const again = await request('/rest/v1/rpc/registrar_push_subscription_com_modo', a.jwt, refreshed)
      assert.equal(again.status, 200); assert.equal(again.data, first.data)
      assert.equal(sql(`select auth=${q(refreshed.p_auth)} and id_usuario=${q(a.id)} from public.push_subscriptions where id=${q(first.data)};`), 't')
    }
  })
  for (const mode of ['minimal', 'enhanced']) await run('atomic response discarded: one request only, committed mode remains ' + mode, async () => {
    let mutations = 0
    const args = { ...atomicArgs(a, mode), p_endpoint: data.p_endpoint + '-lost-' + mode }
    const discardResponse = async () => {
      mutations++; const response = await request('/rest/v1/rpc/registrar_push_subscription_com_modo', a.jwt, args)
      assert.equal(response.status, 200); subscriptions.push(response.data)
      throw Error('simulated_lost_response_after_commit')
    }
    await assert.rejects(discardResponse(), /simulated_lost_response/)
    const observed = await request('/rest/v1/rpc/consultar_push_subscription', a.jwt, { p_endpoint: args.p_endpoint })
    assert.equal(observed.status, 200); assert.equal(typeof observed.data, 'string')
    assert.equal(ownMode(observed.data), mode); assert.equal(mutations, 1)
  })
  await run('no redundant setter remains exposed or available', async () => {
    assert.equal(sql("select to_regprocedure('public.definir_modo_notificacao_push(uuid,text)')is null;"), 't')
    const result = await request('/rest/v1/rpc/definir_modo_notificacao_push', a.jwt, { p_subscription_id: id, p_mode: 'enhanced' })
    assert.equal(result.status, 404)
  })
} finally {
  for (const id of subscriptions) sql(`delete from public.push_subscriptions where id=${q(id)} and endpoint like ${q(data.p_endpoint + '%')};`)
  fs.writeFileSync(path.join(c.context.root, 'd-api-result.json'), JSON.stringify({ cases, directDenials, complete: cases.length === 12 }, null, 2))
}
console.log('D_DATA_API_COMPLETE')
