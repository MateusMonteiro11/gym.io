import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const script = readFileSync(new URL('../../../public/push-sw.js', import.meta.url), 'utf8')
const payload = { version: 1, type: 'test', title: 'Gym.io', body: 'Notificações de treino ativadas.', data: { url: '/dashboard' } }
function worker(windows = []) {
  const handlers = {}; const shown = []; const opened = []
  const self = { addEventListener: (type, fn) => { handlers[type] = fn }, location: { origin: 'http://localhost:5173' },
    registration: { showNotification: async (...args) => shown.push(args) },
    clients: { matchAll: async () => windows, openWindow: async (url) => opened.push(url) } }
  vm.runInNewContext(script, { self, URL })
  return { handlers, shown, opened }
}
test('worker accepts only the fixed versioned test payload', async () => {
  const w = worker(); let completion
  for (const value of [null, {}, { ...payload, version: 2 }, { ...payload, type: 'workout' }, { ...payload, data: { url: 'https://evil.example/' } }, { ...payload, jwt: 'private' }]) {
    w.handlers.push({ data: { json: () => value }, waitUntil: () => assert.fail('invalid payload accepted') })
  }
  w.handlers.push({ data: { json: () => { throw new Error('bad JSON') } }, waitUntil: () => assert.fail() })
  w.handlers.push({ data: { json: () => payload }, waitUntil: (promise) => { completion = promise } }); await completion
  assert.equal(w.shown.length, 1); assert.equal(w.shown[0][1].data.url, '/dashboard')
})
test('click focuses only same-origin window and never navigates external URL', async () => {
  const calls = []; const w = worker([{ url: 'https://other.example/', focus: () => assert.fail() },
    { url: 'http://localhost:5173/treinos', navigate: async (url) => calls.push(url), focus: async () => calls.push('focus') }])
  let completion
  w.handlers.notificationclick({ notification: { data: { url: '/dashboard' }, close: () => calls.push('close') }, waitUntil: (promise) => { completion = promise } })
  await completion; assert.deepEqual(calls, ['close', '/dashboard', 'focus']); assert.deepEqual(w.opened, [])
})
test('click without a window opens the fixed route; actions/external data are ignored', async () => {
  const w = worker(); let completion
  w.handlers.notificationclick({ notification: { data: { url: '/dashboard' }, close() {} }, waitUntil: (promise) => { completion = promise } }); await completion
  assert.deepEqual(w.opened, ['/dashboard'])
  w.handlers.notificationclick({ notification: { data: { url: 'https://evil.example/' }, close() {} }, waitUntil: () => assert.fail() })
})
