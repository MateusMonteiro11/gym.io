import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getFinalCompletionScroll,
  getRibbonProfile,
  getRibbonSegmentCount,
  mapPageToScene,
} from './ribbonProfiles.js'

test('selects a deterministic ribbon profile at each responsive boundary', () => {
  assert.equal(getRibbonProfile(1440).key, 'desktop')
  assert.equal(getRibbonProfile(1024).key, 'tablet')
  assert.equal(getRibbonProfile(390).key, 'mobile')
  assert.equal(getRibbonProfile(320).key, 'small-mobile')
})

test('keeps page and scene coordinates in a single native-scroll space', () => {
  assert.equal(mapPageToScene(0), 0)
  assert.equal(mapPageToScene(1834.625), 1834.625)
})

test('keeps mesh density inside the active responsive profile bounds', () => {
  const profile = getRibbonProfile(390)
  const layout = { profile, rootHeight: 20000 }
  assert.equal(getRibbonSegmentCount(layout), profile.maxSegments)

  layout.rootHeight = 100
  assert.equal(getRibbonSegmentCount(layout), profile.minSegments)
})

test('completes shortly before the physical end of the page', () => {
  const layout = {
    cta: { top: 5700, height: 1000 },
    rootHeight: 7000,
    viewportHeight: 1000,
  }
  assert.equal(getFinalCompletionScroll(layout), 5940)
})

test('keeps the final completion buffer between 24 and 64 pixels', () => {
  assert.equal(getFinalCompletionScroll({ rootHeight: 2000, viewportHeight: 320 }), 1656)
  assert.equal(getFinalCompletionScroll({ rootHeight: 3000, viewportHeight: 1400 }), 1536)
})
