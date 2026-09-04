import assert from 'node:assert/strict'
import test from 'node:test'

import { buildExerciseHeatmap } from './dashboardInsights.js'

function localDate(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour)
}

test('heatmap reports the exercise total for the selected period', () => {
  const reference = localDate(2026, 9, 4)
  const history = [
    { data_execucao: localDate(2025, 9, 1), total_exercicios: 4 },
    { data_execucao: localDate(2026, 1, 10), total_exercicios: 3 },
    { data_execucao: localDate(2026, 1, 10, 18), total_exercicios: 2 },
    { data_execucao: localDate(2026, 9, 3), total_exercicios: 6 },
    { data_execucao: localDate(2026, 9, 5), total_exercicios: 9 },
  ]

  const currentYear = buildExerciseHeatmap(history, reference, { range: 'current-year' })
  const rollingYear = buildExerciseHeatmap(history, reference, { range: 'rolling-year' })

  assert.equal(currentYear.totalExercises, 11)
  assert.equal(rollingYear.totalExercises, 15)
})

test('heatmap total ignores zero, invalid and negative exercise counts', () => {
  const reference = localDate(2026, 9, 4)
  const history = [
    { data_execucao: localDate(2026, 9, 1), total_exercicios: 0 },
    { data_execucao: localDate(2026, 9, 2), total_exercicios: -3 },
    { data_execucao: localDate(2026, 9, 3), total_exercicios: 'inválido' },
  ]

  const heatmap = buildExerciseHeatmap(history, reference)

  assert.equal(heatmap.totalExercises, 0)
})
