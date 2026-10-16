import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
import { createWorkoutNotificationAdapter } from './workoutProjection.js'
import { baseSession, items, sessionId, generation, sessionSequence, controls, cardRegistration, memoryMarkers } from './sessionCard.testHarness.js'
const script = fs.readFileSync(new URL('../../../public/push-sw.js', import.meta.url), 'utf8')
function worker(reg = cardRegistration(), data = memoryMarkers(), options = {}) {
  const sent = [], opened = [], handlers = {}
  const context = vm.createContext({ URL, Notification: { maxActions: options.maxActions ?? 3,
    prototype: options.attention === false ? {} : { renotify: false, vibrate: [] } },
    self: { registration: reg.registration, location: { origin: 'https://gymio.example' }, addEventListener: (t, cb) => handlers[t] = cb,
      clients: { matchAll: async () => [], openWindow: async url => opened.push(url) } } })
  vm.runInContext(script, context)
  const processor = vm.runInContext('createWorkoutProcessor', context)({ registration: reg.registration, store: data.store,
    now: options.now ?? (() => Date.parse('2026-10-10T10:00:00Z')),
    sendAction: async capability => { sent.push(capability); return options.response ?? { result: 'stale' } } })
  return { reg, data, context, processor, sent, opened, handlers }
}
for (const native of [true, false]) test(`20 projections: one latest card, native coalescing ${native}`, async () => {
  const w = worker(cardRegistration(native))
  const frames = sessionSequence()
  for (const { step, value, alert } of frames) {
    assert.ok(value); assert.ok(w.reg.live().length <= 1)
    const result = await w.processor.project(value, alert)
    assert.equal(result.verified, true, step); assert.equal(w.reg.live().length, 1, step)
    const card = w.reg.live()[0], shown = w.reg.shown.at(-1)
    assert.equal(card.tag, `gymio-workout-${sessionId}`)
    assert.equal(card.title, value.pausada ? 'Treino pausado' : alert ? 'Descanso concluído' : value.exercicio)
    assert.equal(card.data.publication.revision, value.revisao)
    assert.equal(card.data.publication.observed, value.agora_servidor)
    assert.equal(shown.options.renotify, alert); assert.equal(shown.options.silent, !alert)
    if (!alert) assert.equal(shown.options.vibrate, undefined)
    assert.equal(Object.hasOwn(shown.options, 'requireInteraction'), false)
  }
  if (native) assert.equal(w.reg.events.filter(e => e.reason === 'explicit').length, 0)
  else { assert.ok(w.reg.events.some(e => e.reason === 'explicit')); assert.ok(w.reg.shown.slice(2).every(s => s.beforeCount === 0)) }
  const rest = w.reg.shown[2].options.body, added = w.reg.shown[5].options.body
  assert.match(rest, /^Descanso · próxima 2\/4 · até \d\d:\d\d$/); assert.notEqual(rest, added)
  assert.equal(w.reg.shown[3].title, 'Treino pausado')
  assert.equal(w.reg.shown[3].options.body, 'Supino reto · Série 2/4')
  assert.equal(w.reg.shown[11].title, 'Descanso concluído')
  assert.equal(w.reg.shown[11].options.body, 'Crucifixo · Série 2/3')
  assert.equal(w.reg.shown[7].title, 'Crucifixo')
  assert.equal(w.reg.shown[7].options.body, 'Série 1/3')
  assert.ok(!JSON.stringify([...w.data.markers]).includes('capability'))
})
test('duplicate cards repaired, and unchanged tokens copied before preclose', async () => {
  const w = worker(cardRegistration(false)), value = controls()
  await w.processor.project(value)
  const original = w.reg.live()[0]
  w.reg.cards.push({ ...original, data: structuredClone(original.data), closed: false, close() { this.closed = true } })
  const unchanged = { ...value, controls_status: 'unchanged', controls: [] }
  assert.equal((await w.processor.project(unchanged)).verified, true)
  assert.equal(w.reg.live().length, 1)
  assert.equal(w.reg.live()[0].data.projection.controls[0].capability, value.controls[0].capability)
  assert.equal(w.reg.shown.at(-1).beforeCount, 0)
  await w.processor.project(unchanged); assert.equal(w.reg.live().length, 1)
})
test('stale revision/time cannot close a newer card, even with stale storage after restart', async () => {
  const w = worker(cardRegistration(false)), frames = sessionSequence()
  await w.processor.project(frames[3].value)
  const card = w.reg.live()[0], count = w.reg.shown.length
  w.data.markers.set('projection', { session: sessionId, revision: '1', observed: Date.parse(frames[0].value.agora_servidor), started: baseSession.iniciada_em })
  const restarted = worker(w.reg, w.data)
  await restarted.processor.project(frames[0].value)
  await restarted.processor.project({ ...frames[3].value, agora_servidor: frames[2].value.agora_servidor })
  assert.equal(w.reg.shown.length, count); assert.equal(card.closed, false)
})
test('two sessions close previous card and reject older session', async () => {
  const w = worker(), first = sessionSequence()[0].value
  await w.processor.project(first)
  const second = { ...first, id_sessao: '33333333-3333-4333-8333-333333333333',
    iniciada_em: '2026-10-10T11:00:00Z', agora_servidor: '2026-10-10T11:00:01Z' }
  await w.processor.project(second); assert.equal(w.reg.live().length, 1); assert.equal(w.reg.live()[0].data.sessionId, second.id_sessao)
  await w.processor.project(first); assert.equal(w.reg.live().length, 1); assert.equal(w.reg.live()[0].data.sessionId, second.id_sessao)
})
test('indeterminate old card is preserved without publication', async () => {
  const reg = cardRegistration(), w = worker(reg)
  await w.data.store.decide(sessionSequence()[0].value, false)
  reg.cards.push({ tag: `gymio-workout-${sessionId}`, data: { sessionId }, closed: false, close() { this.closed = true } })
  const result = await w.processor.project(sessionSequence()[0].value)
  assert.equal(result.published, false); assert.equal(reg.live().length, 1); assert.equal(reg.shown.length, 0)
})

test('a newer or indeterminate card appearing during show is preserved', async () => {
  for (const newer of [true, false]) {
    const w = worker(cardRegistration(false)), frames = sessionSequence()
    w.reg.api.onShow = () => w.reg.cards.push({ tag: `gymio-workout-${sessionId}`, closed: false,
      data: newer ? { publication: { session: sessionId, revision: frames[3].value.revisao,
        observed: frames[3].value.agora_servidor, started: frames[3].value.iniciada_em } } : {},
      close() { this.closed = true } })
    const result = await w.processor.project(frames[0].value)
    assert.equal(result.verified, false); assert.equal(w.reg.live().length, 1)
    assert.equal(w.reg.cards[0].closed, true); assert.equal(w.reg.cards[1].closed, false)
  }
})
test('dismissal and restart reproject silently, without session tombstone', async () => {
  const w = worker(cardRegistration(false)), value = sessionSequence()[0].value
  await w.processor.project(value); w.reg.live()[0].close()
  const restarted = worker(w.reg, w.data); await restarted.processor.project(value)
  assert.equal(w.reg.live().length, 1); assert.equal(w.reg.shown.at(-1).options.silent, true)
  assert.equal(w.data.markers.get(`closed:${sessionId}`), undefined)
})
test('only confirmed end can reserve an alert; Push/local/restart dedup', async () => {
  const w = worker(cardRegistration(false)), frames = sessionSequence()
  await w.processor.project(frames[0].value, true)
  await w.processor.project(frames[2].value, true)
  assert.ok(w.reg.shown.every(s => s.options.silent && !s.options.renotify && s.options.vibrate === undefined))
  assert.equal([...w.data.markers.keys()].some(key => key.startsWith('receipt:')), false)
  const end = frames[11].value
  await Promise.all([w.processor.project(end, true), w.processor.project(end, true)])
  const restarted = worker(w.reg, w.data); await restarted.processor.project(end, true)
  assert.equal(w.reg.shown.filter(s => s.options.renotify).length, 1); assert.equal(w.reg.live().length, 1)
  const unsupported = worker(cardRegistration(), memoryMarkers(), { attention: false })
  await unsupported.processor.project(end, true)
  assert.equal(unsupported.reg.shown[0].options.renotify, false); assert.equal(unsupported.reg.shown[0].options.vibrate, undefined)
})
for (const result of ['stale', 'expired', 'already_used', 'unavailable']) test(`${result} invalidates only generation, keeps readonly card without advancing marker`, async () => {
  const w = worker(cardRegistration(false), memoryMarkers(), { response: { result } }), value = controls()
  await w.processor.project(value); const current = structuredClone(w.data.markers.get('projection'))
  await w.processor.action(w.reg.live()[0], 'rest_skip')
  assert.equal(w.reg.live().length, 1); assert.equal(w.reg.live()[0].body, 'Abra o treino para atualizar')
  assert.equal(w.reg.live()[0].data.projection, undefined)
  assert.equal(w.reg.shown.at(-1).options.actions, undefined)
  assert.equal(w.reg.shown.at(-1).options.silent, true)
  assert.deepEqual(w.data.markers.get('projection'), current)
  assert.equal(w.data.markers.get(`generation:${generation}`), true)
  await w.processor.project({ ...value, controls_status: 'unchanged', controls: [] })
  assert.equal(w.reg.live()[0].body, 'Abra o treino para atualizar'); assert.equal(w.sent.length, 1)
})
test('expired click sends nothing; C ok updates same card without opening PWA', async () => {
  const value = controls(), expired = worker(cardRegistration(), memoryMarkers(), { now: () => Date.parse(value.expires_at) + 1 })
  const normal = worker(expired.reg, expired.data); await normal.processor.project(value)
  await expired.processor.action(expired.reg.live()[0], 'rest_skip')
  assert.equal(expired.sent.length, 0); assert.equal(expired.reg.live().length, 1); assert.equal(expired.reg.live()[0].data.projection, undefined)
  const next = { ...value, revisao: '4', generation_id: '33333333-3333-4333-8333-333333333333', agora_servidor: '2026-10-10T10:00:06Z' }
  const w = worker(cardRegistration(false), memoryMarkers(), { response: { result: 'ok', projection: next } })
  await w.processor.project(value); await w.processor.action(w.reg.live()[0], 'rest_add_15')
  assert.equal(w.reg.live().length, 1); assert.equal(w.reg.live()[0].data.publication.revision, '4')
  assert.deepEqual(w.opened, []); assert.equal(w.reg.shown.at(-1).options.silent, true)
})
test('enumeration and show failures never claim invariant verified or retry automatically', async () => {
  const w = worker(); w.reg.api.failEnumerationAt = 1
  assert.equal((await w.processor.project(sessionSequence()[0].value)).verified, false); assert.equal(w.reg.shown.length, 0)
  w.reg.api.failEnumerationAt = null; w.reg.api.failShow = true
  assert.equal((await w.processor.project(sessionSequence()[0].value)).published, false); assert.equal(w.reg.shown.length, 0)
  const after = worker(); after.reg.api.failEnumerationAt = 3
  assert.equal((await after.processor.project(sessionSequence()[0].value)).verified, false)
  assert.equal(after.reg.shown.length, 1)
  const absent = worker(); await absent.processor.project(sessionSequence()[0].value)
  const existing = absent.reg.live()[0]
  delete absent.reg.registration.getNotifications
  assert.equal((await absent.processor.project(sessionSequence()[1].value)).verified, false)
  assert.equal(absent.reg.shown.length, 1); assert.equal(existing.closed, false)
})

test('presentation preserves wire fields, omits missing totals and retains execution pause context', async () => {
  const w = worker(), frames = sessionSequence(), input = { ...frames[0].value,
    pausada: true, title: 'Gym.io · Pausado', serie_total: null, exercicio: 'X'.repeat(80) }
  const serialized = JSON.stringify(input)
  await w.processor.project(input)
  const presentation = w.reg.shown.at(-1)
  assert.equal(JSON.stringify(input), serialized)
  assert.equal(presentation.title, 'Treino pausado')
  assert.match(presentation.options.body, /^X{80} · Série 1$/)
  assert.match(presentation.options.body, /Série 1$/)
  assert.ok(Array.from(presentation.options.body).length <= 160)
  assert.equal(presentation.options.actions, undefined)
  assert.equal(presentation.options.requireInteraction, undefined)
})
test('finish/cancel/remove adapter close, logout and disable are terminal, including after restart', async () => {
  for (const terminal of ['finalizada', 'cancelada', 'removed', 'logout', 'disable']) {
    const w = worker(cardRegistration(false)), first = sessionSequence()[0].value
    await w.processor.project(first)
    if (terminal === 'logout' || terminal === 'disable') await w.processor.disable(terminal === 'logout')
    else {
      const calls = [], adapter = createWorkoutNotificationAdapter({ close: id => { calls.push(w.processor.close(id)) } })
      adapter.accept(baseSession, terminal === 'removed' ? null : { ...baseSession, status: terminal }, items)
      await Promise.all(calls)
    }
    assert.equal(w.reg.live().length, 0, terminal)
    const restarted = worker(w.reg, w.data); await restarted.processor.enable(); await restarted.processor.project(first)
    assert.equal(w.reg.live().length, 0, terminal)
  }
})
