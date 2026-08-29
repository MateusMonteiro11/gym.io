import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HERO_INTRO_DURATION_MS,
  getHeroIntroReveal,
  shouldRunHeroIntro,
} from './ribbonIntro.js'

const introInput = {
  initialReveal: .02,
  heroEnd: .18,
  scrollReveal: .02,
  eligible: true,
}

test('reveals the hero with a deterministic 1.2 second ease-out introduction', () => {
  const start = getHeroIntroReveal({ ...introInput, elapsedMs: 0 })
  const firstThird = getHeroIntroReveal({ ...introInput, elapsedMs: 400 })
  const secondThird = getHeroIntroReveal({ ...introInput, elapsedMs: 800 })
  const complete = getHeroIntroReveal({ ...introInput, elapsedMs: HERO_INTRO_DURATION_MS })

  assert.equal(start.reveal, .02)
  assert.ok(firstThird.reveal > start.reveal)
  assert.ok(secondThird.reveal > firstThird.reveal)
  assert.equal(complete.reveal, .18)
  assert.equal(complete.active, false)
})

test('never pulls the active head behind exact native-scroll reveal', () => {
  const state = getHeroIntroReveal({
    ...introInput,
    elapsedMs: 240,
    scrollReveal: .42,
  })
  assert.equal(state.reveal, .42)
  assert.equal(state.active, false)
})

test('keeps the complete hero as the minimum reveal after presentation', () => {
  const state = getHeroIntroReveal({
    ...introInput,
    elapsedMs: 2400,
    scrollReveal: .02,
  })
  assert.equal(state.reveal, .18)
})

test('skips presentation for hashes, restoration, reduced motion and non-top loads', () => {
  assert.equal(shouldRunHeroIntro({ rawScroll: 0 }), true)
  assert.equal(shouldRunHeroIntro({ rawScroll: 3 }), false)
  assert.equal(shouldRunHeroIntro({ rawScroll: 0, hash: '#progress' }), false)
  assert.equal(shouldRunHeroIntro({ rawScroll: 0, navigationType: 'back_forward' }), false)
  assert.equal(shouldRunHeroIntro({ rawScroll: 0, reducedMotion: true }), false)

  const restored = getHeroIntroReveal({
    ...introInput,
    scrollReveal: .12,
    eligible: false,
  })
  assert.equal(restored.reveal, .18)
  assert.equal(restored.active, false)
})
