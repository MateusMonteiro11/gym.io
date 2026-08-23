import test from 'node:test'
import assert from 'node:assert/strict'

import { calcularDescanso } from '../src/hooks/useDescansoTimer.js'
import { calcularTempoTreino, formatElapsed } from '../src/hooks/useWorkoutTimer.js'

test('cronômetro geral deriva o tempo absoluto após background', () => {
  const sessao = {
    status: 'ativa',
    iniciada_em: '2026-08-21T12:00:00.000Z',
    pausada_em: null,
    segundos_pausados: 20,
  }

  assert.equal(
    calcularTempoTreino(sessao, Date.parse('2026-08-21T12:02:10.000Z')),
    110
  )
  assert.equal(formatElapsed(110), '01:50')
})

test('cronômetro geral permanece estável enquanto pausado', () => {
  const sessao = {
    status: 'ativa',
    iniciada_em: '2026-08-21T12:00:00.000Z',
    pausada_em: '2026-08-21T12:01:20.000Z',
    segundos_pausados: 10,
  }

  assert.equal(
    calcularTempoTreino(sessao, Date.parse('2026-08-21T12:30:00.000Z')),
    70
  )
})

test('descanso é reconstruído pelo deadline após background', () => {
  const sessao = {
    status: 'ativa',
    fase: 'descanso',
    descanso_iniciado_em: '2026-08-21T12:00:00.000Z',
    descanso_termina_em: '2026-08-21T12:01:30.000Z',
    descanso_padrao_segundos: 90,
  }

  assert.deepEqual(
    calcularDescanso(sessao, Date.parse('2026-08-21T12:00:50.000Z')),
    { ativo: true, restante: 40, total: 90, percentual: 44 }
  )

  assert.deepEqual(
    calcularDescanso(sessao, Date.parse('2026-08-21T12:02:00.000Z')),
    { ativo: false, restante: 0, total: 90, percentual: 0 }
  )
})

test('pausa geral congela o descanso no instante da pausa', () => {
  const sessao = {
    status: 'ativa',
    fase: 'descanso',
    pausada_em: '2026-08-21T12:00:20.000Z',
    descanso_iniciado_em: '2026-08-21T12:00:00.000Z',
    descanso_termina_em: '2026-08-21T12:01:00.000Z',
  }

  assert.equal(
    calcularDescanso(sessao, Date.parse('2026-08-21T12:00:50.000Z')).restante,
    40
  )
})
