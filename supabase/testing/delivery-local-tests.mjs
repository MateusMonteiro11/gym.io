// Real PostgreSQL + real B/C wrappers; only HTTP transport is injected.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { actionsContext } from './delivery-context.mjs'
import { actionsFixture } from './actions-fixture.mjs'
import { createWorkoutPushHandler } from '../functions/_shared/workoutPushHandler.js'

const c = actionsContext(process.argv[2]), { sql, value, literal: q, concurrentSql } = c
const schema = 'gymio_workout_push_private', cases = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const capture = () => value(`select ${schema}.capture_events();`)
const claims = () => value('select public.workout_push_claim(10);')
const begin = (claim) => value(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`)
const registerMode = (f, ps, next, user = f.a) => sql(`begin;set local role authenticated;
 select set_config('request.jwt.claim.sub',${q(user.id)},true);
 select public.registrar_push_subscription_com_modo(${q(ps.endpoint)},${q(ps.p256dh)},${q(ps.auth)},${q(next)});commit;`).split('\n').at(-1)
const mode = (f, id, next) => {
  const ps = value(`select to_jsonb(ps)from public.push_subscriptions ps where id=${q(id)};`)
  assert.equal(registerMode(f, ps, next), id)
}
const state = (id) => value(`select jsonb_build_object('state',state,'attempted',attempted_at is not null) from ${schema}.deliveries where id=${q(id)};`)
const counts = () => value(`select jsonb_build_object('events',(select count(*) from ${schema}.outbox),
 'deliveries',(select count(*) from ${schema}.deliveries),'attempts',(select count(*) from ${schema}.deliveries where attempted_at is not null));`)
async function due(f) {
  f.start(1)
  // PostgreSQL clock controls eligibility; wait for the actual server deadline.
  const left = Number(sql(`select greatest(extract(epoch from descanso_termina_em-clock_timestamp()),0) from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`))
  await sleep(Math.ceil(left * 1000) + 80)
  assert.equal(sql(`select descanso_termina_em<=clock_timestamp() from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`), 't')
}
async function run(name, test) {
  assert.deepEqual(counts(), { events: 0, deliveries: 0, attempts: 0 }, 'dedicated test database must be empty between cases')
  const f = actionsFixture(c)
  let passed = false
  try { await test(f); passed = true; console.log(`PASS D SQL: ${name}`) }
  finally { f.clean(); cases.push({ name, passed }); fs.writeFileSync(path.join(c.context.root, 'd-sql-result.json'), JSON.stringify({ cases }, null, 2)) }
}
function sender({ beforeBegin = async () => {}, send = async () => 201 } = {}) {
  let providerCalls = 0
  const workerToken = 'A'.repeat(43)
  const handler = createWorkoutPushHandler({ workerToken, initialize: async () => ({
    repository: { claim: async () => claims(), begin: async (claim) => { await beforeBegin(claim); return begin(claim) },
      complete: async (claim, outcome, snapshot) => sql(`select public.workout_push_complete(${q(claim.id)},${q(claim.claim_token)},${q(outcome)},${q(JSON.stringify(snapshot))}::jsonb);`) },
    sendPush: async (...args) => { providerCalls++; return send(...args) },
  }) })
  return { run: async () => {
    const response = await handler(new Request('http://localhost/functions/v1/workout-push', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gymio-Workout-Worker-Token': workerToken }, body: '{}',
    })); assert.equal(response.status, 200); return response.json()
  }, get calls() { return providerCalls } }
}

await run('one minimal + one enhanced: exactly one frozen recipient', async (f) => {
  const minimal = f.subscribe(), enhanced = f.subscribe(); mode(f, enhanced, 'enhanced')
  await due(f); assert.deepEqual(capture(), { events: 1, deliveries: 1 })
  assert.equal(sql(`select subscription_id from ${schema}.deliveries;`), enhanced)
  assert.equal(sql(`select count(*) from ${schema}.deliveries where subscription_id=${q(minimal)};`), '0')
})
await run('two minimal: tick creates event, zero delivery, zero dispatch and unchanged HTTP queue', async (f) => {
  f.subscribe(); f.subscribe(); await due(f)
  const queue = sql('select count(*) from net.http_request_queue;')
  const tick = value(`select ${schema}.tick();`)
  assert.equal(tick.dispatched, false); assert.deepEqual(counts(), { events: 1, deliveries: 0, attempts: 0 })
  assert.equal(sql('select count(*) from net.http_request_queue;'), queue)
  const fake = sender(); assert.equal((await fake.run()).attempted, 0); assert.equal(fake.calls, 0)
})
await run('two enhanced: normal C-bound sender, one attempt each, no retry', async (f) => {
  const ids = [f.subscribe(), f.subscribe()]; ids.forEach((id) => mode(f, id, 'enhanced'))
  await due(f); assert.deepEqual(capture(), { events: 1, deliveries: 2 })
  const sent = [], fake = sender({ send: async (snapshot, payload) => { sent.push(snapshot.id); assert.equal(payload.version, 3); return 201 } })
  assert.equal((await fake.run()).accepted, 2); assert.equal(fake.calls, 2)
  assert.deepEqual(sent.sort(), ids.sort()); await fake.run(); assert.equal(fake.calls, 2)
  assert.equal(sql(`select count(*) from gymio_workout_actions_private.generations g join ${schema}.deliveries d on d.subscription_id=g.subscription_id
    join ${schema}.outbox e on e.id=d.event_id where g.id_sessao<>e.id_sessao;`), '0')
})
await run('upgrade after frozen event never backfills; next physical event includes it', async (f) => {
  const id = f.subscribe(); await due(f); capture(); mode(f, id, 'enhanced')
  assert.deepEqual(capture(), { events: 0, deliveries: 0 }); assert.equal(counts().deliveries, 0)
  f.mutate('encerrar_descanso_treino_sessao', 'true'); f.mutate('concluir_treino_serie', '20', '10')
  await sleep(1100); assert.deepEqual(capture(), { events: 1, deliveries: 1 })
})
for (const afterClaim of [false, true]) await run(`downgrade ${afterClaim ? 'after claim' : 'before claim'} is irreversible and unattempted`, async (f) => {
  const id = f.subscribe(); mode(f, id, 'enhanced'); await due(f); capture()
  const claim = afterClaim ? claims()[0] : null, delivery = sql(`select id from ${schema}.deliveries;`)
  mode(f, id, 'minimal'); mode(f, id, 'enhanced')
  assert.deepEqual(state(delivery), { state: 'stale', attempted: false }); assert.deepEqual(claims(), [])
  if (claim) assert.equal(begin(claim), null)
  const fake = sender(); await fake.run(); assert.equal(fake.calls, 0)
})
await run('downgrade during sender after claim prevents transport', async (f) => {
  const id = f.subscribe(); mode(f, id, 'enhanced'); await due(f); capture()
  const fake = sender({ beforeBegin: async () => mode(f, id, 'minimal') })
  assert.equal((await fake.run()).attempted, 0); assert.equal(fake.calls, 0); assert.equal(counts().attempts, 0)
})
await run('re-register resets enhanced and stales pending work even with identical keys', async (f) => {
  const id = f.subscribe(); mode(f, id, 'enhanced'); await due(f); capture()
  const ps = value(`select to_jsonb(ps) from public.push_subscriptions ps where id=${q(id)};`)
  const registered = sql(`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(f.a.id)},true);
    select public.registrar_push_subscription(${q(ps.endpoint)},${q(ps.p256dh)},${q(ps.auth)});commit;`).split('\n').at(-1)
  assert.equal(registered, id)
  assert.equal(sql(`select workout_notification_mode from public.push_subscriptions where id=${q(id)};`), 'minimal')
  assert.equal(sql(`select state from ${schema}.deliveries;`), 'stale'); assert.equal(counts().attempts, 0)
})
await run('atomic enhanced re-register preserves UUID, ownership and pending delivery; failed mode rolls back', async (f) => {
  const id = f.subscribe(), ps = value(`select to_jsonb(ps)from public.push_subscriptions ps where id=${q(id)};`)
  assert.equal(registerMode(f, ps, 'minimal'), id); assert.equal(registerMode(f, ps, 'enhanced'), id)
  await due(f); capture()
  assert.equal(registerMode(f, ps, 'enhanced'), id)
  assert.equal(sql(`select state from ${schema}.deliveries;`), 'pending')
  const before = sql(`select to_jsonb(ps)from public.push_subscriptions ps where id=${q(id)};`)
  assert.throws(() => registerMode(f, ps, 'unsupported'))
  assert.equal(sql(`select to_jsonb(ps)from public.push_subscriptions ps where id=${q(id)};`), before)
  assert.throws(() => registerMode(f, ps, 'enhanced', f.b))
  assert.equal(sql(`select to_jsonb(ps)from public.push_subscriptions ps where id=${q(id)};`), before)
})
await run('removal after claim cascades, no mint or HTTP; attempted outcome never retried after downgrade', async (f) => {
  const id = f.subscribe(); mode(f, id, 'enhanced'); await due(f); capture(); const claim = claims()[0]
  f.rpc('remover_push_subscription', [q(id)]); assert.equal(begin(claim), null); assert.equal(counts().deliveries, 0)
  const fresh = f.subscribe(); mode(f, fresh, 'enhanced'); f.reset(); await due(f); capture()
  const fake = sender({ send: async () => { mode(f, fresh, 'minimal'); throw Error('unknown result') } })
  assert.equal((await fake.run()).failed, 1); assert.equal(fake.calls, 1); await fake.run(); assert.equal(fake.calls, 1)
})
for (const captureFirst of [false, true]) await run(`concurrent capture/downgrade barrier: ${captureFirst ? 'capture' : 'downgrade'} locks first`, async (f) => {
  const id = f.subscribe(); mode(f, id, 'enhanced'); await due(f)
  // Advisory marker proves the row lock was acquired before the second process
  // starts. It is test coordination only; the production code has no marker.
  const marker = captureFirst ? 320041 : 320042
  const update = `update public.push_subscriptions set workout_notification_mode='minimal' where id=${q(id)};`
  const captureSQL = `select ${schema}.capture_events();`
  const first = concurrentSql(`begin;${captureFirst ? captureSQL : update}select pg_advisory_xact_lock(${marker});select pg_sleep(2);commit;`)
  let ready = false
  for (let i = 0; i < 40; i++) {
    if (sql(`select exists(select 1 from pg_locks where locktype='advisory' and classid=0 and objid=${marker} and granted);`) === 't') { ready = true; break }
    await sleep(10)
  }
  assert.ok(ready, 'first process must hold its subscription lock before racing')
  await Promise.all([first, concurrentSql(captureFirst ? update : captureSQL)])
  assert.equal(counts().attempts, 0)
  assert.equal(sql(`select count(*) from ${schema}.deliveries where state in('pending','claimed');`), '0')
  const fake = sender(); await fake.run(); assert.equal(fake.calls, 0)
})
await run('concurrent processors cannot double claim or attempt', async (f) => {
  const id = f.subscribe(); mode(f, id, 'enhanced'); await due(f); capture()
  const claimed = (await Promise.all([concurrentSql('select public.workout_push_claim(10);'), concurrentSql('select public.workout_push_claim(10);')])).flatMap(JSON.parse)
  assert.equal(claimed.length, 1)
  const claim = claimed[0], attempts = await Promise.all([concurrentSql(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`), concurrentSql(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`)])
  assert.equal(attempts.filter((result) => result && result !== 'null').length, 1)
})
await run('no redundant index; record actual per-user capture EXPLAIN', async (f) => {
  const id = f.subscribe(); mode(f, id, 'enhanced')
  // EXPLAIN's JSON result is pretty-printed across lines; consume the complete
  // single result, rather than the context helper for one-line JSON RPC rows.
  const plan = JSON.parse(sql(`explain(format json,analyze,buffers)select id from public.push_subscriptions where id_usuario=${q(f.a.id)} and workout_notification_mode='enhanced';`))
  fs.writeFileSync(path.join(c.context.root, 'd-capture-plan.json'), JSON.stringify(plan, null, 2))
  assert.equal(sql("select count(*)from pg_index where indrelid='public.push_subscriptions'::regclass;"), '3', 'PK + unique endpoint + existing user index')
})
assert.equal(sql("select count(*)from cron.job where jobname='gymio-workout-push' and not active;"), '1')
console.log(`D_SQL_COMPLETE ${cases.length} cases; zero real provider requests`)
