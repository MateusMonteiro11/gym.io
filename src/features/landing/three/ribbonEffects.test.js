import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EFFECT_DEAD_ZONE,
  clampEffectVelocity,
  getEffectTarget,
  stepEffectChannel,
} from './ribbonEffects.js'

test('clamps cosmetic velocity without affecting position data', () => {
  assert.equal(clampEffectVelocity(4000), 1800)
  assert.equal(clampEffectVelocity(-4000), -1800)
})

test('drops the cosmetic target to idle after input stops', () => {
  assert.equal(getEffectTarget({ rawVelocity: 800, lastInputTime: 100 }, 120), 800)
  assert.equal(getEffectTarget({ rawVelocity: 800, lastInputTime: 100 }, 140), 0)
})

test('tiny alternating trackpad input does not flip cosmetic direction', () => {
  const current = { velocity: 1, direction: 1, strength: 0, idle: true }
  const next = stepEffectChannel(current, -2, 1 / 60)
  assert.equal(next.direction, 1)
  assert.ok(Math.abs(next.velocity) < EFFECT_DEAD_ZONE)
})

test('effect velocity settles to zero without overshoot', () => {
  let state = { velocity: 420, direction: 1, strength: 1, idle: false }
  for (let index = 0; index < 60; index += 1) {
    state = stepEffectChannel(state, 0, 1 / 60)
  }
  assert.equal(state.velocity, 0)
  assert.equal(state.direction, 1)
  assert.equal(state.idle, true)
})
