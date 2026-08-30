import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSmoothHashState,
  shouldAnimateHashNavigation,
  SMOOTH_HASH_NAVIGATION,
} from './hashNavigation.js'

test('marks user-initiated hash links without discarding existing route state', () => {
  assert.deepEqual(getSmoothHashState({ source: 'footer' }), {
    source: 'footer',
    hashNavigation: SMOOTH_HASH_NAVIGATION,
  })
})

test('animates only user pushes when motion is allowed', () => {
  const state = getSmoothHashState()

  assert.equal(shouldAnimateHashNavigation({ navigationType: 'PUSH', state, reducedMotion: false }), true)
  assert.equal(shouldAnimateHashNavigation({ navigationType: 'POP', state, reducedMotion: false }), false)
  assert.equal(shouldAnimateHashNavigation({ navigationType: 'PUSH', state, reducedMotion: true }), false)
  assert.equal(shouldAnimateHashNavigation({ navigationType: 'PUSH', state: null, reducedMotion: false }), false)
})
