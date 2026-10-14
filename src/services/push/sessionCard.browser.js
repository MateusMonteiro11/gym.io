// Local browser verification only. Uses real IndexedDB, synthetic registrations,
// and an injected transport. No permission request, service worker registration,
// Supabase call or Push provider is involved.
import { sessionId, generation, sessionSequence, controls, cardRegistration } from './sessionCard.testHarness.js'

export async function runSessionCardBrowserChecks(source) {
  const checks = []
  const assert = (condition, message) => { if (!condition) throw Error(message) }
  const equal = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), message)
  const factory = window.indexedDB
  const name = 'gymio-workout-notification-receipts'
  const requestResult = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  async function scenario(native = false, options = {}) {
    await requestResult(factory.deleteDatabase(name))
    const databases = new Set(), sent = [], reg = cardRegistration(native)
    const guardedFactory = { open(...args) {
      const request = factory.open(...args)
      request.addEventListener('success', () => databases.add(request.result))
      return request
    } }
    const restart = (response = options.response ?? { result: 'stale' }) => {
      const handlers = {}
      const self = { indexedDB: guardedFactory, registration: reg.registration,
        location: { origin: location.origin }, addEventListener: (type, handler) => handlers[type] = handler }
      const api = new Function('self', 'Notification', `${source};return {createWorkoutStore,createWorkoutProcessor,workoutProcessor}`)(self,
        { maxActions: options.maxActions ?? 3, prototype: options.attention === false ? {} : { renotify: false, vibrate: [] } })
      const store = api.createWorkoutStore(guardedFactory)
      const processor = api.createWorkoutProcessor({ store, registration: reg.registration,
        now: () => Date.parse('2026-10-10T10:00:00Z'),
        sendAction: async token => { sent.push(token); return response } })
      const dispatch = (type, detail) => {
        let pending
        handlers[type]({ ...detail, waitUntil: value => pending = value })
        return pending
      }
      return { store, processor, dispatch }
    }
    async function inspect() {
      const database = await requestResult(factory.open(name, 1))
      equal([...database.objectStoreNames], ['markers'], 'only the original marker store may exist')
      const store = database.transaction('markers').objectStore('markers')
      const [keys, values] = await Promise.all([requestResult(store.getAllKeys()), requestResult(store.getAll())])
      database.close()
      const serialized = JSON.stringify({ keys, values })
      assert(!/(capability|access_token|refresh_token|authorization|jwt)/i.test(serialized), 'no credential fields in IndexedDB')
      for (const control of controls().controls) assert(!serialized.includes(control.capability), 'no bearer persisted')
      return { keys, values }
    }
    return { reg, sent, restart, inspect, close: () => { for (const database of databases) database.close() } }
  }
  async function check(label, execute, native = false, options = {}) {
    const s = await scenario(native, options)
    try { await execute(s); await s.inspect(); checks.push(label) } finally { s.close() }
  }
  for (const native of [true, false]) await check(`20 projections / native=${native}`, async s => {
    let worker = s.restart()
    for (const [index, frame] of sessionSequence().entries()) {
      assert(s.reg.live().length <= 1, 'at most one card before each publication')
      if (index === 10) worker = s.restart()
      const result = await worker.processor.project(frame.value, frame.alert)
      assert(result.verified, `invariant verified for ${frame.step}`)
      equal(s.reg.live().length, 1, 'one card after each publication')
      equal(s.reg.live()[0].data.publication.revision, frame.value.revisao, 'latest revision')
      const options = s.reg.shown.at(-1).options
      equal(options.silent, !frame.alert, 'only confirmed end may alert')
      equal(options.renotify, frame.alert, 'attention preference')
      if (!frame.alert) assert(!('vibrate' in options), 'normal updates have no vibration')
    }
  }, native)
  await check('local/Push race + restart: one durable alert', async s => {
    const signal = sessionSequence()[11].value, first = s.restart()
    await Promise.all([
      first.dispatch('push', { data: { json: () => signal } }),
      first.dispatch('message', { source: { url: `${location.origin}/treinar/9007199254740993` },
        data: { type: 'gymio_workout_rest_finished', payload: signal } }),
    ])
    equal(s.reg.live().length, 1, 'race leaves one session card')
    await s.restart().processor.project(signal, true)
    equal(s.reg.shown.filter(value => value.options.renotify).length, 1, 'receipt survives restart')
    const persisted = await s.inspect()
    equal(persisted.keys.filter(key => key.startsWith('receipt:')).length, 1, 'physical rest has one receipt')
  })
  await check('unchanged resolved before duplicate preclose; absent-card fallback', async s => {
    const value = controls(), first = s.restart()
    await first.processor.project(value)
    const original = s.reg.live()[0]
    s.reg.cards.push({ ...original, data: structuredClone(original.data), closed: false, close() { this.closed = true } })
    await s.restart().processor.project({ ...value, controls_status: 'unchanged', controls: [] })
    equal(s.reg.live().length, 1, 'duplicates repaired after restart')
    equal(s.reg.live()[0].data.projection.controls, value.controls, 'tokens copied before card closure')
    equal(s.reg.shown.at(-1).beforeCount, 0, 'preclose after observed coalescing failure')
    s.reg.live()[0].close()
    await s.restart().processor.project({ ...value, controls_status: 'unchanged', controls: [] })
    assert(!s.reg.live()[0].data.projection, 'dismissed card does not reconstruct controls')
    assert(!s.reg.shown.at(-1).options.actions, 'absent-card fallback has no actions')
  })
  for (const result of ['stale', 'expired', 'already_used', 'unavailable']) await check(`${result}: readonly generation, unchanged marker`, async s => {
    const value = controls(), worker = s.restart()
    await worker.processor.project(value)
    const before = await worker.store.current()
    await worker.processor.action(s.reg.live()[0], 'rest_skip')
    equal(s.reg.live().length, 1, 'generation closure preserves logical card')
    equal(s.reg.live()[0].body, 'Abra o treino para atualizar', 'readonly feedback')
    assert(!s.reg.live()[0].data.projection && !s.reg.shown.at(-1).options.actions, 'no retained bearer/actions')
    equal(await worker.store.current(), before, 'invalidation must not advance projection marker')
    await s.restart().processor.project(value)
    equal(s.reg.live().length, 1, 'old generation blocked after restart')
    const fresh = { ...value, revisao: '4', generation_id: '33333333-3333-4333-8333-333333333333', agora_servidor: '2026-10-10T10:00:06Z' }
    await s.restart().processor.project(fresh)
    equal(s.reg.live()[0].data.projection.generation_id, fresh.generation_id, 'new generation in same session is permitted')
    const persisted = await s.inspect()
    assert(!persisted.keys.includes(`closed:${sessionId}`), 'generation invalidation is not a session tombstone')
    assert(persisted.keys.includes(`generation:${generation}`), 'generation marker persisted')
  }, false, { response: { result } })
  for (const maxActions of [0, 1, 2, 3]) await check(`maxActions=${maxActions}`, async s => {
    const worker = s.restart()
    await worker.processor.project(controls())
    const actions = s.reg.shown.at(-1).options.actions
    if (maxActions === 0) assert(!actions, 'actions property omitted without proven support')
    else equal(actions.map(control => control.action), ['rest_add_15', 'rest_skip', 'rest_pause'].slice(0, maxActions), 'inline priorities')
  }, false, { maxActions })
  for (const terminal of ['finish', 'cancel', 'remove', 'logout', 'disable']) await check(`${terminal}: tombstone with zero cards`, async s => {
    const value = sessionSequence()[0].value, worker = s.restart()
    await worker.processor.project(value)
    s.reg.live()[0].close() // Terminal correctness must not depend on a visible card.
    if (terminal === 'logout' || terminal === 'disable') await worker.processor.disable(terminal === 'logout')
    else await worker.processor.close(sessionId)
    const restarted = s.restart()
    await restarted.processor.enable(); await restarted.processor.project(value)
    equal(s.reg.live().length, 0, 'late messages cannot reopen a terminated session')
    const persisted = await s.inspect()
    assert(persisted.keys.includes(`closed:${sessionId}`), 'terminal session marker persisted')
  })
  await check('dismissal is not terminal; recovery is silent', async s => {
    const value = sessionSequence()[0].value
    await s.restart().processor.project(value); s.reg.live()[0].close()
    await s.restart().processor.project(value)
    equal(s.reg.live().length, 1, 'valid recovery recreates dismissed card')
    assert(s.reg.shown.at(-1).options.silent, 'recovery is silent')
    assert(!(await s.inspect()).keys.includes(`closed:${sessionId}`), 'dismissal never tombstones session')
  })
  await check('vibration unavailable is compatible', async s => {
    await s.restart().processor.project(sessionSequence()[11].value, true)
    assert(!('vibrate' in s.reg.shown[0].options), 'unsupported vibration omitted')
    equal(s.reg.shown[0].options.renotify, false, 'unsupported renotify not requested')
  }, false, { attention: false })
  await requestResult(factory.deleteDatabase(name))
  return { passed: true, checks, storage: 'real browser IndexedDB', projections: 40 }
}
