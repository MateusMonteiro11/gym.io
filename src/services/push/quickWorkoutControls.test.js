import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { isPushEntry, quickControlState, createQuickWorkoutController } from './quickWorkoutControls.js'
import { useQuickWorkoutControls } from '../../hooks/useQuickWorkoutControls.js'
import WorkoutQuickControls from '../../components/WorkoutQuickControls.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture(paused = false, confirmationTimeout = 1000) {
  const calls = [], updates = []
  const player = { carregandoSessao: false, salvando: false, sessaoConflitante: null,
    sessao: { id_sessao: 'session-a', id_treino: '3', id_usuario: 'user-a', id_treino_exercicio_atual: '7', serie_atual: 2,
      revisao: 4, status: 'ativa', fase: 'descanso', pausada_em: paused ? '2026-10-10T10:00:00Z' : null,
      descanso_termina_em: '2026-10-10T10:01:00Z' },
    descansoTimer: { restante: 38, adicionarTempo: async () => { calls.push('add15'); return true } },
    workoutTimer: { toggle: async () => { calls.push('toggle'); return true } },
    pularDescanso: async () => { calls.push('skip'); return true }, continuarSerie: async () => { calls.push('continue'); return true } }
  const snapshot = { fromPush: true, userId: 'user-a', workoutId: '3', scopeKey: 'entry', player }
  const controller = createQuickWorkoutController(next => updates.push(next), confirmationTimeout)
  controller.update(snapshot)
  return { calls, updates, player, snapshot, controller }
}
test('query is UX only; controls derive confirmed rest and owner/context, never query workout state', () => {
  assert.equal(isPushEntry('?from=push'), true)
  for (const search of ['', '?from=other', '?from=push&from=other']) assert.equal(isPushEntry(search), false)
  const { snapshot } = fixture()
  assert.equal(quickControlState(snapshot), 'active')
  for (const change of [{ fromPush: false }, { userId: null }, { userId: 'user-b' }, { workoutId: '4' }])
    assert.equal(quickControlState({ ...snapshot, ...change }), null)
  for (const change of [{ carregandoSessao: true }, { sessaoConflitante: {} }, { sessao: null },
    { sessao: { ...snapshot.player.sessao, status: 'finalizada' } }, { sessao: { ...snapshot.player.sessao, fase: 'execucao' } },
    { sessao: { ...snapshot.player.sessao, descanso_termina_em: 'bad' } }])
    assert.equal(quickControlState({ ...snapshot, player: { ...snapshot.player, ...change } }), null)
})
test('five controls reuse Player handlers; presentation does not mutate confirmed state', async () => {
  for (const [action, paused, remaining, expected] of [['add', false, 38, 'add15'], ['skip', false, 38, 'skip'],
    ['pause', false, 38, 'toggle'], ['resume', true, 38, 'toggle'], ['continue', false, 0, 'continue']]) {
    const f = fixture(paused); f.player.descansoTimer.restante = remaining
    const original = JSON.stringify(f.player.sessao)
    assert.equal(await f.controller.execute(action), true); assert.deepEqual(f.calls, [expected])
    assert.equal(JSON.stringify(f.player.sessao), original)
  }
})
test('paused skip waits for committed confirmation and uses fresh unpaused callback', async () => {
  const f = fixture(true), operation = f.controller.execute('skip'); await tick()
  assert.deepEqual(f.calls, ['toggle'])
  f.controller.update({ ...f.snapshot, player: { ...f.player, sessao: { ...f.player.sessao, pausada_em: null, revisao: 5 },
    pularDescanso: async () => { f.calls.push('fresh-skip'); return true } } })
  assert.equal(await operation, true); assert.deepEqual(f.calls, ['toggle', 'fresh-skip'])
})
test('paused skip reports partial failure and does not rollback or retry', async () => {
  const f = fixture(true), operation = f.controller.execute('skip'); await tick()
  f.controller.update({ ...f.snapshot, player: { ...f.player, sessao: { ...f.player.sessao, pausada_em: null, revisao: 5 },
    pularDescanso: async () => { f.calls.push('skip'); return false } } })
  assert.equal(await operation, false); assert.deepEqual(f.calls, ['toggle', 'skip'])
  assert.ok(f.updates.some(u => u.feedback?.includes('retomado, mas')))
})
for (const change of ['item', 'series', 'session', 'navigation', 'logout', 'unmount']) {
  test(`paused skip stops after ${change} changes`, async () => {
    const f = fixture(true), operation = f.controller.execute('skip'); await tick()
    const next = { ...f.snapshot, player: { ...f.player, sessao: { ...f.player.sessao, pausada_em: null, revisao: 5 } } }
    if (change === 'item') next.player.sessao.id_treino_exercicio_atual = '8'
    if (change === 'series') next.player.sessao.serie_atual = 3
    if (change === 'session') next.player.sessao.id_sessao = 'other'
    if (change === 'navigation') next.scopeKey = 'other-entry'
    if (change === 'logout') next.userId = null
    if (change === 'unmount') f.controller.unmount(); else f.controller.update(next)
    assert.equal(await operation, false); assert.deepEqual(f.calls, ['toggle'])
  })
}
test('no confirmation, resume failure and network/stale never report success', async () => {
  const timeout = fixture(true, 5); assert.equal(await timeout.controller.execute('skip'), false)
  assert.deepEqual(timeout.calls, ['toggle']); assert.ok(timeout.updates.some(u => u.feedback?.includes('confirmar')))
  for (const result of ['false', 'throw']) {
    const f = fixture(); f.player.descansoTimer.adicionarTempo = async () => { if (result === 'throw') throw Error('stale'); return false }
    assert.equal(await f.controller.execute('add'), false); assert.ok(f.updates.some(u => u.feedback))
  }
  const f = fixture(true); f.player.workoutTimer.toggle = async () => false
  assert.equal(await f.controller.execute('skip'), false); assert.deepEqual(f.calls, [])
})
test('in-flight gestures and V2 busy state block duplicates', async () => {
  const f = fixture(); let release
  f.player.pularDescanso = () => new Promise(resolve => { release = resolve })
  const first = f.controller.execute('skip'); assert.equal(await f.controller.execute('add'), false)
  release(true); assert.equal(await first, true)
  f.player.salvando = true; assert.equal(await f.controller.execute('pause'), false)
})
test('component offers only eligible controls with touch targets and busy disabling', () => {
  for (const [state, labels] of [['active', ['+15s', 'Pular', 'Pausar']], ['paused', ['Retomar', 'Pular']], ['finished', ['Continuar']]]) {
    let view; const calls = []
    act(() => { view = create(React.createElement(WorkoutQuickControls, { state, busy: false, onAction: a => calls.push(a) })) })
    assert.deepEqual(view.root.findAllByType('button').map(b => b.children[0]), labels)
    assert.ok(view.root.findAllByType('button').every(b => b.props.className.includes('min-h-12')))
    act(() => { view.update(React.createElement(WorkoutQuickControls, { state, busy: true, onAction() {} })) })
    assert.ok(view.root.findAllByType('button').every(b => b.props.disabled)); act(() => view.unmount())
  }
})
test('React integration waits for committed callback and preserves busy across the two calls', async () => {
  const f = fixture(true); let output, view, finish
  function Probe({ snapshot }) { output = useQuickWorkoutControls(snapshot); return null }
  act(() => { view = create(React.createElement(Probe, { snapshot: f.snapshot })) })
  let operation
  await act(async () => { operation = output.execute('skip'); await tick() })
  assert.equal(output.busy, true); assert.deepEqual(f.calls, ['toggle'])
  await act(async () => { view.update(React.createElement(Probe, { snapshot: { ...f.snapshot, player: { ...f.player,
    sessao: { ...f.player.sessao, pausada_em: null, revisao: 5 }, pularDescanso: () => new Promise(resolve => { finish = resolve }) } } })); await tick() })
  assert.equal(output.busy, true)
  await act(async () => { finish(true); await operation }); assert.equal(output.busy, false)
  act(() => view.unmount())
})
