import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
import { buildWorkoutProjection } from './workoutProjection.js'

const script = fs.readFileSync(new URL('../../../public/push-sw.js', import.meta.url), 'utf8')
const sessionId = '11111111-1111-4111-8111-111111111111'
const session = { id_sessao: sessionId, id_treino: '9007199254740993', id_treino_exercicio_atual: '2', serie_atual: 2,
  revisao: '3', status: 'ativa', fase: 'descanso', pausada_em: null, iniciada_em: '2026-10-10T10:00:00Z',
  descanso_iniciado_em: '2026-10-10T10:00:30Z', descanso_termina_em: '2026-10-10T10:02:00Z', agora_servidor: '2026-10-10T10:01:00Z' }
const token = (n) => Buffer.alloc(32, n).toString('base64url')
const payload = { ...buildWorkoutProjection(session, [{ id_treino_exercicio: '2', nome: 'Supino', series: 4 }]),
  version: 3, type: 'workout_control', generation_id: '22222222-2222-4222-8222-222222222222',
  expires_at: '2026-10-10T10:15:00Z', eligible_state: 'rest_active', controls_status: 'emitted',
  controls: ['rest_add_15', 'rest_skip', 'rest_pause'].map((action, i) => ({ action, capability: token(i + 1) })) }
function worker(notification, windows = []) {
  const handlers = {}, shown = [], opened = [], sent = []
  const cards = []
  const registration = { getNotifications: async (options = {}) => cards.filter(c => !c.closed && (!options.tag || c.tag === options.tag)),
    showNotification: async (title, options) => {
      for (const c of cards) if (c.tag === options.tag) c.closed = true
      cards.push({ tag: options.tag, data: options.data, closed: false, close() { this.closed = true } })
      shown.push({ title, options })
    } }
  const context = vm.createContext({ URL, ...(notification === undefined ? {} : { Notification: notification }),
    self: { registration, location: { origin: 'https://gymio.example' }, addEventListener: (type, cb) => handlers[type] = cb,
      clients: { matchAll: async () => windows, openWindow: async (route) => opened.push(route) } } })
  vm.runInContext(script, context)
  const processor = vm.runInContext('createWorkoutProcessor', context)({ registration,
    store: { decide: async () => ({ show: true, alert: false }), actionAllowed: async () => true, closeGeneration: async () => {} },
    now: () => Date.parse(session.agora_servidor), sendAction: async (capability) => { sent.push(capability); return { result: 'stale' } } })
  return { context, processor, shown, opened, sent, handlers }
}
for (const max of [undefined, null, 0, -1, 1.5, '2', NaN, Infinity, 1, 2, 3, 9]) {
  test(`feature detection and action priority: ${String(max)}`, async () => {
    const w = worker(max === undefined ? undefined : { maxActions: max })
    await w.processor.project(payload)
    const limit = Number.isInteger(max) && max > 0 ? max : 0
    const options = w.shown[0].options
    if (!limit) assert.equal(Object.hasOwn(options, 'actions'), false)
    else assert.equal(options.actions.map(a => a.action).join(','), payload.controls.slice(0, limit).map(a => a.action).join(','))
    assert.equal(options.tag, `gymio-workout-${sessionId}`)
    assert.equal(options.silent, true)
  })
}
test('Notification with missing maxActions omits actions; paused and expired priorities respect positive limits', async () => {
  const missing = worker({}); await missing.processor.project(payload)
  assert.equal(Object.hasOwn(missing.shown[0].options, 'actions'), false)
  for (const max of [1, 2, 3]) {
    const w = worker({ maxActions: max })
    await w.processor.project({ ...payload, pausada: true, title: 'Gym.io · Pausado', eligible_state: 'rest_paused',
      controls: [{ action: 'rest_resume', capability: token(4) }, { action: 'rest_skip', capability: token(5) }] })
    assert.equal(w.shown.at(-1).options.actions.map(a => a.action).join(','), ['rest_resume', 'rest_skip'].slice(0, max).join(','))
    await w.processor.project({ ...payload, title: 'Gym.io · Descanso concluído', eligible_state: 'rest_finished',
      agora_servidor: '2026-10-10T10:02:01Z', controls: [{ action: 'rest_continue', capability: token(6) }] })
    assert.equal(w.shown.at(-1).options.actions.map(a => a.action).join(','), 'rest_continue')
  }
})
async function click(w, data, action = '') {
  let promise
  w.handlers.notificationclick({ action, notification: { data, close() {} }, waitUntil: p => { promise = p } })
  await promise
}
test('body fallback builds only non-sensitive query after strict route validation', async () => {
  const route = `/treinar/${session.id_treino}`, data = { url: route, sessionId }
  const w = worker(undefined); await click(w, data)
  assert.deepEqual(w.opened, [route + '?from=push'])
  const supported = worker({ maxActions: 2 }); await click(supported, data)
  assert.deepEqual(supported.opened, [route])
  for (const invalid of ['/treinar/01', '/treinar/0', '/treinar/9223372036854775808', route + '?from=push',
    route + '?capability=secret', '//evil.example', 'https://evil.example/treinar/1', '/treinar/1#fragment']) {
    await click(w, { ...data, url: invalid })
  }
  await click(w, { ...data, sessionId: 'invalid' })
  assert.equal(w.opened.length, 1)
  await click(w, { url: '/dashboard' }); assert.equal(w.opened.at(-1), '/dashboard')
})
test('fallback navigates/focuses same-origin existing window, never an external client', async () => {
  const calls = [], w = worker({ maxActions: 0 }, [{ url: 'https://other.example', focus: () => assert.fail() },
    { url: 'https://gymio.example/dashboard', navigate: async route => calls.push(route), focus: async () => calls.push('focus') }])
  await click(w, { url: '/treinar/3', sessionId })
  assert.deepEqual(calls, ['/treinar/3?from=push', 'focus']); assert.deepEqual(w.opened, [])
})
test('inline action sends only C bearer and opens no app', async () => {
  const w = worker({ maxActions: 2 })
  await w.processor.action({ data: { projection: payload } }, 'rest_add_15')
  assert.deepEqual(w.sent, [payload.controls[0].capability]); assert.deepEqual(w.opened, [])
})
