import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { buildWorkoutLifecycle, createWorkoutNotificationAdapter } from './workoutProjection.js'
import { createWorkoutNotificationBridge } from './workoutNotificationBridge.js'
import { createWorkoutHistoryLookup } from './workoutHistoryLookup.js'
import { createWorkoutControlsIssuer } from './workoutControlsClient.js'
import { baseSession, items, sessionId, sessionSequence, controls, cardRegistration, memoryMarkers } from './sessionCard.testHarness.js'
const source = fs.readFileSync(new URL('../../../public/push-sw.js', import.meta.url), 'utf8')
const start = () => buildWorkoutLifecycle(baseSession, 'start')
const finalized = { ...baseSession, status: 'finalizada', revisao: '30', agora_servidor: '2026-10-10T10:10:00Z' }
const complete = id => buildWorkoutLifecycle(finalized, 'complete', id)
function worker(maxActions = 0, shared = {}) {
  const reg = shared.reg ?? cardRegistration(false), data = shared.data ?? memoryMarkers(), handlers = {}, opened = [], sent = []
  const context = vm.createContext({ URL, Notification: { maxActions, prototype: { renotify: false, vibrate: [] } },
    self: { registration: reg.registration, location: { origin: 'https://gymio.example' }, addEventListener: (type, handler) => handlers[type] = handler,
      clients: { matchAll: async () => shared.windows ?? [], openWindow: async url => opened.push(url) } } })
  vm.runInContext(source, context)
  const processor = vm.runInContext('createWorkoutProcessor', context)({ store: data.store, registration: reg.registration,
    now: () => Date.parse(baseSession.agora_servidor), sendAction: async token => { sent.push(token); return { result: 'stale' } } })
  vm.runInContext('workoutProcessor.project=()=>{}', context) // Rebind only handler dispatch to the test processor/store.
  context.testProcessor = processor
  vm.runInContext('workoutProcessor.project=testProcessor.project;workoutProcessor.lifecycle=testProcessor.lifecycle', context)
  return { reg, data, context, handlers, processor, opened, sent }
}
async function dispatch(w, type, detail) {
  let result
  w.handlers[type]({ ...detail, waitUntil: promise => result = promise })
  await result
}
for (const maxActions of [0, 1, 2, 3]) test(`lifecycle policy maxActions=${maxActions}: start, intermediate states, one terminal`, async () => {
  const w = worker(maxActions)
  await w.processor.lifecycle('start', start())
  const initial = w.reg.live()[0]
  assert.equal(initial.title, 'Gym.io · Treino iniciado')
  assert.equal(initial.data.projection, undefined); assert.equal(w.reg.shown[0].options.actions, undefined)
  for (const frame of sessionSequence()) await w.processor.project(frame.value, frame.alert)
  await w.processor.project(controls(sessionSequence()[14].value))
  const shown = w.reg.shown.length
  await dispatch(w, 'push', { data: { json: () => sessionSequence()[11].value } })
  if (!maxActions) {
    assert.equal(shown, 1); assert.equal(w.reg.shown.length, 1)
    assert.equal(w.reg.live()[0], initial)
    assert.equal([...w.data.markers.keys()].some(key => key.startsWith('receipt:')), false)
    await w.processor.action({ data: { projection: controls() } }, 'rest_skip'); assert.equal(w.sent.length, 0)
  } else {
    assert.ok(shown >= 21)
    const active = worker(maxActions); await active.processor.project(controls())
    assert.equal(active.reg.shown[0].options.actions.length, Math.min(maxActions, 3))
  }
  await w.processor.lifecycle('complete', complete('7'))
  assert.equal(w.reg.live().length, 1)
  const terminal = w.reg.live()[0]
  assert.equal(terminal.title, 'Treino concluído')
  assert.equal(terminal.tag, `gymio-workout-complete-${sessionId}`)
  assert.equal(terminal.data.url, '/historico?period=all&workout=7')
  assert.equal(terminal.data.projection, undefined); assert.equal(w.reg.shown.at(-1).options.actions, undefined)
  const restarted = worker(maxActions, w)
  await Promise.all([restarted.processor.lifecycle('start', start()), restarted.processor.lifecycle('complete', complete('7')),
    restarted.processor.project(sessionSequence()[19].value)])
  assert.equal(w.reg.live().length, 1); assert.equal(w.reg.live()[0], terminal)
  assert.equal(w.reg.shown.filter(card => card.title === 'Gym.io · Treino iniciado').length, 1)
  assert.equal(w.reg.shown.filter(card => card.title === 'Treino concluído').length, 1)
})

test('start/completion input validates IDs, status, exact local envelope and no arbitrary URL', async () => {
  assert.equal(buildWorkoutLifecycle({ ...baseSession, status: 'finalizada' }, 'start'), null)
  assert.equal(buildWorkoutLifecycle(baseSession, 'complete'), null)
  assert.equal(complete(9007199254740993).id_historico, null)
  assert.equal(complete('01').id_historico, null)
  for (const payload of [{ ...start(), revisao: '01' }, { ...start(), id_sessao: 'bad' }, { ...start(), id_treino: '0' },
    { ...start(), url: '//evil.example' }, { ...complete('7'), id_historico: '01' }, { ...complete('7'), capability: 'forbidden' }]) {
    const w = worker(); await w.processor.lifecycle(payload.type === 'workout_session_started' ? 'start' : 'complete', payload)
    assert.equal(w.reg.shown.length, 0)
  }
  const w = worker()
  await dispatch(w, 'message', { source: { url: 'https://evil.example' }, data: { type: 'gymio_workout_start', payload: start() } })
  await dispatch(w, 'push', { data: { json: () => complete('7') } })
  assert.equal(w.reg.shown.length, 0, 'remote Push cannot invent a local start/completion')
})

test('start is explicit accepted context; recovery/repeated render never announces it', async () => {
  const calls = [], adapter = createWorkoutNotificationAdapter({ start: value => calls.push(value.type), project: () => calls.push('project') })
  await adapter.accept(null, baseSession, items)
  await adapter.accept(baseSession, baseSession, items)
  assert.deepEqual(calls, ['project', 'project'])
  await adapter.accept(null, baseSession, items, { started: true })
  assert.deepEqual(calls.slice(-2), ['workout_session_started', 'project'])
  const hook = fs.readFileSync(new URL('../../hooks/useTreinoAtivo.js', import.meta.url), 'utf8')
  assert.match(hook, /aplicarRespostaConfirmada\(resposta, \{ started: true \}\)/)
  assert.match(hook, /registrarSessao\(estado\.sessao, estado\.series, \{ started: true \}\)/)
  assert.equal((hook.match(/started: true/g) ?? []).length, 2, 'only start RPC success and its confirmed transport reconciliation announce start')
})

for (const path of ['manual', 'last_set', 'last_exercise', 'reconciled_transport']) test(`confirmed ${path} transition uses the same completion lifecycle`, async () => {
  const calls = []
  const adapter = createWorkoutNotificationAdapter({ complete: value => calls.push(value), close: () => assert.fail('completion must own its terminal close') }, null,
    async id => { assert.equal(id, sessionId); return { id_sessao: id, id_historico: '9007199254740993' } })
  await adapter.accept(baseSession, finalized, items)
  await adapter.accept(finalized, { ...finalized }, items)
  assert.equal(calls.length, 1); assert.equal(calls[0].id_historico, '9007199254740993')
})

test('unconfirmed/cancelled/removed state has no completion; read failure falls back, no retry', async () => {
  let reads = 0
  const calls = [], bridge = { complete: value => calls.push(value), close: id => calls.push(`close:${id}`), project: () => {} }
  const adapter = createWorkoutNotificationAdapter(bridge, null, async () => { reads++; throw Error('synthetic_network') })
  await adapter.accept(baseSession, { ...baseSession }, items)
  await adapter.accept(baseSession, null, items)
  await adapter.accept(baseSession, { ...baseSession, status: 'cancelada' }, items)
  assert.equal(reads, 0); assert.equal(calls.filter(call => typeof call === 'object').length, 0)
  await adapter.accept(baseSession, finalized, items)
  await adapter.accept(finalized, finalized, items)
  assert.equal(reads, 1); assert.equal(calls.at(-1).id_historico, null)
  const w = worker(); await w.processor.lifecycle('complete', complete(null))
  assert.equal(w.reg.live()[0].data.url, '/historico?period=all')
})

for (const reason of ['cancel', 'remove', 'logout', 'disable']) test(`${reason} closes known notifications and rejects late completion`, async () => {
  const w = worker()
  await w.processor.lifecycle('start', start())
  if (reason === 'logout' || reason === 'disable') await w.processor.disable(reason === 'logout')
  else await w.processor.close(sessionId)
  const restarted = worker(0, w); await restarted.processor.enable()
  await restarted.processor.lifecycle('complete', complete('7'))
  await restarted.processor.lifecycle('start', start())
  assert.equal(w.reg.live().length, 0)
  assert.equal(w.reg.shown.filter(card => card.title === 'Treino concluído').length, 0)
})

test('logout/disable capture rejects completion after a slow History read, including re-enable', async () => {
  const messages = [], browser = { isSecureContext: true, Notification: { permission: 'granted' }, localStorage: { getItem: () => null },
    location: { origin: 'https://gymio.example' }, navigator: { serviceWorker: { getRegistration: async () => ({
      active: { scriptURL: 'https://gymio.example/push-sw.js', postMessage: message => messages.push(message) } }) } } }
  const bridge = createWorkoutNotificationBridge(browser)
  let resolve
  const pending = new Promise(done => resolve = done)
  const adapter = createWorkoutNotificationAdapter(bridge, null, () => pending)
  const finished = adapter.accept(baseSession, finalized, items)
  await bridge.disable('logout'); await bridge.enable()
  resolve({ id_historico: '7' }); await finished
  assert.equal(messages.some(message => message.type === 'gymio_workout_complete'), false)
})

test('completion clicks accept exact History URLs only, in existing or new same-origin window', async () => {
  for (const route of ['/historico?period=all', '/historico?period=all&workout=9007199254740993']) {
    const w = worker()
    const notification = { tag: `gymio-workout-complete-${sessionId}`, data: { kind: 'complete', sessionId, url: route }, close() {} }
    await dispatch(w, 'notificationclick', { notification, action: '' })
    assert.deepEqual(w.opened, [route])
    const calls = [], existing = worker(0, { windows: [{ url: 'https://evil.example', focus: () => assert.fail() },
      { url: 'https://gymio.example/dashboard', navigate: async url => calls.push(url), focus: async () => calls.push('focus') }] })
    await dispatch(existing, 'notificationclick', { notification, action: '' })
    assert.deepEqual(calls, [route, 'focus'])
  }
  for (const url of ['/historico', '/historico?period=month&workout=7', '/historico?period=all&workout=01',
    '/historico?period=all&workout=0', '/historico?period=all&workout=9223372036854775808', '/historico?period=all&workout=7&jwt=x',
    '/historico?workout=7&period=all', '/historico?period=all#fragment', '//evil.example', 'https://evil.example/historico?period=all']) {
    const w = worker(); await dispatch(w, 'notificationclick', { action: '', notification: {
      tag: `gymio-workout-complete-${sessionId}`, data: { kind: 'complete', sessionId, url }, close() {} } })
    assert.equal(w.opened.length, 0)
  }
})

test('terminal containment persists even when notification enumeration/publication is unavailable', async () => {
  for (const failure of ['enumeration', 'show']) {
    const w = worker(); await w.processor.lifecycle('start', start())
    if (failure === 'enumeration') w.reg.api.failEnumerationAt = w.reg.api.enumerationCount + 1
    else w.reg.api.failShow = true
    await w.processor.lifecycle('complete', complete('7'))
    assert.equal(w.data.markers.get(`closed:${sessionId}`), true)
    assert.equal(w.data.markers.get(`complete:${sessionId}`), true)
    w.reg.api.failEnumerationAt = null; w.reg.api.failShow = false
    const restarted = worker(2, w), count = w.reg.shown.length
    await restarted.processor.project(sessionSequence()[19].value)
    await restarted.processor.lifecycle('complete', complete('7'))
    assert.equal(w.reg.shown.length, count, 'neither stale session nor ambiguous completion is retried')
  }
})

test('History lookup is two-column authenticated read with no retry, validated linkage and honest absence', async () => {
  for (const row of [{ id_sessao: sessionId, id_historico: 7 }, null, { id_sessao: sessionId, id_historico: '01' },
    { id_sessao: 'different', id_historico: '7' }, { id_sessao: sessionId, id_historico: 9007199254740993 }]) {
    const calls = [], query = { select: value => { calls.push(['select', value]); return query },
      eq: (...args) => { calls.push(['eq', ...args]); return query }, abortSignal: signal => { assert.ok(signal instanceof AbortSignal); return query },
      retry: value => { calls.push(['retry', value]); return query }, maybeSingle: async () => ({ data: row, error: null }) }
    const read = createWorkoutHistoryLookup({ from: table => { calls.push(['from', table]); return query } })
    const result = await read(sessionId)
    assert.equal(result?.id_historico ?? null, row?.id_historico === 7 ? '7' : null)
    assert.deepEqual(calls, [['from', 'historico_treinos'], ['select', 'id_historico,id_sessao'], ['eq', 'id_sessao', sessionId], ['retry', false]])
    assert.equal(await read('invalid'), null)
  }
})

test('History timeout/error has one attempt and aborts without inventing an ID', async () => {
  for (const fail of ['error', 'timeout']) {
    let count = 0, signal
    const query = { select: () => query, eq: () => query, retry: () => query,
      abortSignal: value => { signal = value; return query }, maybeSingle: () => fail === 'error' ? Promise.resolve({ error: Error('private'), data: null }) : new Promise(() => {}) }
    const read = createWorkoutHistoryLookup({ from: () => { count++; return query } }, 10)
    await assert.rejects(read(sessionId), /history_unavailable/)
    assert.equal(count, 1); assert.equal(signal.aborted, fail === 'timeout')
  }
})

test('minimal issuer never reads a subscription or emits controls; fixed UI copy keeps diagnostic button absent', async () => {
  for (const maxActions of [undefined, 0, -1, '2', NaN]) {
    const issuer = createWorkoutControlsIssuer({ browser: { isSecureContext: true, Notification: { permission: 'granted', maxActions },
      navigator: { serviceWorker: { getRegistration: () => assert.fail('minimal mode needs no control issuer read') } } }, rpc: () => assert.fail('no RPC') })
    assert.equal(await issuer(controls()), null)
  }
  const settings = fs.readFileSync(new URL('../../components/PushNotificationSettings.jsx', import.meta.url), 'utf8')
  assert.match(settings, /Tela de Início/); assert.match(settings, /No iPhone e iPad/)
  assert.match(settings, /Este navegador está vinculado à sua conta\./)
  assert.doesNotMatch(settings, /Enviar teste|homologa|userAgent|capabilities|Service Worker|Notification API/)
})
