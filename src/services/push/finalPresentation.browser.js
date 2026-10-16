// Browser-only local tests: real IndexedDB, synthetic cards and no Push provider.
import { buildWorkoutLifecycle } from './workoutProjection.js'
import { sessionId, baseSession, controls, sessionSequence, cardRegistration } from './sessionCard.testHarness.js'

export async function runFinalPresentationBrowserChecks(source) {
  const checks = [], factory = window.indexedDB, name = 'gymio-workout-notification-receipts'
  const assert = (value, message) => { if (!value) throw Error(message) }
  const read = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  })
  const start = buildWorkoutLifecycle(baseSession, 'start')
  const final = buildWorkoutLifecycle({ ...baseSession, status: 'finalizada', revisao: '30', agora_servidor: '2026-10-10T10:10:00Z' }, 'complete', '7')
  async function scenario(maxActions, coalesce, execute) {
    await read(factory.deleteDatabase(name))
    const connections = new Set(), reg = cardRegistration(coalesce)
    const guarded = { open(...args) {
      const request = factory.open(...args); request.addEventListener('success', () => connections.add(request.result)); return request
    } }
    const restart = () => {
      const handlers = {}, self = { indexedDB: guarded, registration: reg.registration, location: { origin: location.origin },
        addEventListener: (type, handler) => handlers[type] = handler }
      const api = new Function('self', 'Notification', `${source};return {createWorkoutStore,createWorkoutProcessor,workoutProcessor}`)(self,
        { maxActions, prototype: { renotify: false, vibrate: [] } })
      const store = api.createWorkoutStore(guarded)
      const processor = api.createWorkoutProcessor({ store, registration: reg.registration, now: () => Date.parse(baseSession.agora_servidor),
        sendAction: () => { throw Error('browser fixture must never send a capability') } })
      api.workoutProcessor.project = processor.project; api.workoutProcessor.lifecycle = processor.lifecycle
      const dispatch = (type, detail) => {
        let pending; handlers[type]({ ...detail, waitUntil: promise => pending = promise }); return pending
      }
      return { processor, store, dispatch }
    }
    try {
      await execute({ restart, reg })
      const db = await read(factory.open(name, 1)), store = db.transaction('markers').objectStore('markers')
      const [keys, values] = await Promise.all([read(store.getAllKeys()), read(store.getAll())]); db.close()
      const serialized = JSON.stringify({ keys, values })
      assert(!/capability|id_historico|jwt|authorization|access_token/i.test(serialized), 'persist only receipts/ordering/tombstones')
      for (const control of controls().controls) assert(!serialized.includes(control.capability), 'no bearer persistence')
    } finally { for (const db of connections) db.close() }
  }
  for (const max of [0, 1, 2, 3]) for (const native of [true, false]) {
    await scenario(max, native, async ({ restart, reg }) => {
      const w = restart()
      await w.processor.lifecycle('start', start)
      const first = reg.live()[0]
      for (const frame of sessionSequence()) await w.processor.project(frame.value, frame.alert)
      if (!max) {
        await w.processor.project(controls())
        const due = sessionSequence()[11].value
        await w.dispatch('push', { data: { json: () => due } })
        await w.dispatch('push', { data: { json: () => controls(due) } })
        assert(reg.shown.length === 1 && reg.live()[0] === first, 'minimal: zero local or remote intermediate notifications')
        assert(!(await w.store.current()).generation, 'minimal: no control state persisted')
      } else assert(reg.live().length === 1 && reg.shown.at(-1).title === 'Gym.io · Treino', 'enhanced keeps latest mini-player')
      await restart().processor.lifecycle('start', start)
      await w.processor.lifecycle('complete', final)
      assert(first.closed, 'terminal lifecycle closes the original start/card')
      assert(reg.live().length === 1 && reg.live()[0].title === 'Treino concluído', 'one terminal notification')
      assert(reg.live()[0].data.url === '/historico?period=all&workout=7', 'exact History destination')
      assert(!reg.shown.at(-1).options.actions && !reg.live()[0].data.projection, 'completion cannot contain controls')
      const next = restart()
      await Promise.all([next.processor.lifecycle('complete', final), next.processor.lifecycle('start', start), next.processor.project(sessionSequence()[19].value)])
      assert(reg.shown.filter(card => card.title === 'Gym.io · Treino iniciado').length === 1, 'start receipt persists')
      assert(reg.shown.filter(card => card.title === 'Treino concluído').length === 1, 'completion receipt persists')
      reg.live()[0].close(); await restart().processor.lifecycle('complete', final)
      assert(reg.live().length === 0, 'dismissed completion is not retried')
    })
    checks.push(`start/complete restart dedup, maxActions=${max}, native=${native}`)
  }
  await scenario(0, false, async ({ restart, reg }) => {
    const a = restart(), b = restart()
    await Promise.all([a.processor.lifecycle('start', start), b.processor.lifecycle('start', start)])
    assert(reg.shown.length === 1, 'atomic start reservation across independent workers')
    await Promise.all([a.processor.lifecycle('complete', final), b.processor.lifecycle('complete', final)])
    assert(reg.shown.filter(card => card.title === 'Treino concluído').length === 1, 'atomic completion reservation')
    assert(reg.live().length === 1, 'one terminal survives race')
  }); checks.push('independent worker races use atomic start and completion receipts')
  for (const terminal of ['cancel', 'logout', 'disable']) {
    await scenario(0, false, async ({ restart, reg }) => {
      const w = restart(); await w.processor.lifecycle('start', start); reg.live()[0].close()
      if (terminal === 'cancel') await w.processor.close(sessionId)
      else await w.processor.disable(terminal === 'logout')
      const next = restart(); await next.processor.enable()
      await next.processor.lifecycle('start', start); await next.processor.lifecycle('complete', final)
      assert(reg.live().length === 0, 'closed session rejects late lifecycle even with no card at cleanup')
      assert(reg.shown.length === 1, 'cleanup never synthesizes completion')
    }); checks.push(`${terminal}: persisted lifecycle containment`)
  }
  await scenario(0, false, async ({ restart, reg }) => {
    const w = restart(); reg.api.failShow = true
    await w.processor.lifecycle('start', start); reg.api.failShow = false
    await restart().processor.lifecycle('start', start)
    assert(reg.shown.length === 0, 'ambiguous publication is never automatically retried')
    await w.processor.lifecycle('complete', { ...final, id_historico: null })
    assert(reg.live()[0].data.url === '/historico?period=all', 'unknown history uses overview fallback')
  }); checks.push('at-most-once after show failure; honest History fallback')
  await read(factory.deleteDatabase(name))
  return { passed: true, checks, storage: 'real browser IndexedDB' }
}
