import assert from 'node:assert/strict'
import test from 'node:test'
import { createRibbonDataAnchorLayout, getRibbonDataAnchorChecksum } from './ribbonDataAnchors.js'
import { createRibbonGeometry } from './ribbonGeometry.js'
import { RIBBON_STATE } from './ribbonChapters.js'

const layout = {
  profile: {
    key: 'desktop', ribbonWidth: 1.08, twistScale: 1, depthScale: .5,
    segmentPixels: 14, minSegments: 180, maxSegments: 180,
  },
  viewportWidth: 1440,
  viewportHeight: 900,
  rootHeight: 6200,
  chapters: [
    { id: 'hero', top: 0, height: 900 },
    { id: 'flow', top: 900, height: 2500 },
    { id: 'cta', top: 5300, height: 900 },
  ],
  cta: { top: 5300, height: 900 },
  waypoints: [
    { id: 'hero-entry', chapter: 'hero', sectionY: -.28, x: 1181, pageY: -252, z: -.2, twist: -.04, state: RIBBON_STATE.ACTIVE },
    { id: 'hero-entry-steer', chapter: 'hero', sectionY: -.04, x: 1065, pageY: -36, z: -.1, twist: -.014, steering: true, state: RIBBON_STATE.ACTIVE },
    { id: 'hero-arc-top', chapter: 'hero', sectionY: .18, x: 979, pageY: 162, z: -.035, twist: -.008, state: RIBBON_STATE.ACTIVE },
    { id: 'hero-arc-steer', chapter: 'hero', sectionY: .31, x: 900, pageY: 279, z: .018, twist: .003, steering: true, state: RIBBON_STATE.ACTIVE },
    { id: 'hero-title-trace', chapter: 'hero', sectionY: .44, x: 864, pageY: 396, z: .055, twist: .006, state: RIBBON_STATE.ACTIVE },
    { id: 'hero-lower', chapter: 'hero', sectionY: .76, x: 936, pageY: 684, z: .018, twist: .003, state: RIBBON_STATE.ACTIVE },
    { id: 'hero-exit', chapter: 'hero', sectionY: 1.02, x: 1010, pageY: 918, z: -.08, twist: 0, state: RIBBON_STATE.ACTIVE },
    { id: 'flow-series', chapter: 'flow', sectionY: .3, x: 850, pageY: 1650, z: 0, twist: 0, state: RIBBON_STATE.ACTIVE },
    { id: 'cta-entry', chapter: 'cta', sectionY: .04, x: 600, pageY: 5336, z: 0, twist: 0, state: RIBBON_STATE.ACTIVE },
    { id: 'cta-hidden-tail', chapter: 'cta', sectionY: 1.18, x: 1000, pageY: 6100, z: 0, twist: 0, state: RIBBON_STATE.ACTIVE },
  ],
}

const measurements = {
  hero: { top: 0, bottom: 900, left: 0, right: 1440, width: 1440, height: 900 },
  nodes: {
    exercise: { width: 150, height: 78 },
    series: { width: 182, height: 98 },
    previous: { width: 144, height: 50 },
  },
  exclusions: {
    '.hero-copy': { left: 60, right: 790, top: 150, bottom: 780, width: 730, height: 630 },
    '.landing-header': { left: 0, right: 1440, top: 0, bottom: 80, width: 1440, height: 80 },
  },
}

function overlap(first, second) {
  return Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
    * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
}

test('anchors Hero data to path progress outside the headline exclusion', () => {
  const geometry = createRibbonGeometry({ layout, segments: 180 })
  const anchors = createRibbonDataAnchorLayout(layout, geometry, measurements)
  assert.equal(anchors.length, 3)
  anchors.forEach((anchor) => {
    assert.ok(anchor.pathU >= 0 && anchor.pathU <= 1)
    assert.equal(overlap(anchor.rect, measurements.exclusions['.hero-copy']), 0)
  })
})

test('keeps anchor positions and checksum deterministic for one layout epoch', () => {
  const firstGeometry = createRibbonGeometry({ layout, segments: 180 })
  const secondGeometry = createRibbonGeometry({ layout, segments: 180 })
  const first = createRibbonDataAnchorLayout(layout, firstGeometry, measurements)
  const second = createRibbonDataAnchorLayout(layout, secondGeometry, measurements)
  assert.deepEqual(first, second)
  assert.equal(getRibbonDataAnchorChecksum(first), getRibbonDataAnchorChecksum(second))
})
