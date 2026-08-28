import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRibbonGeometry,
  getRibbonRevealState,
  RIBBON_WIDTH_SEGMENTS,
} from './ribbonGeometry.js'
import { RIBBON_STATE } from './ribbonChapters.js'

const layout = {
  profile: {
    key: 'desktop', ribbonWidth: 1.08, twistScale: 1, depthScale: .5,
    segmentPixels: 14, minSegments: 12, maxSegments: 12,
  },
  viewportWidth: 1200,
  viewportHeight: 800,
  rootHeight: 4800,
  cta: { top: 4000, height: 800 },
  waypoints: [
    { id: 'a', chapter: 'hero', x: 900, pageY: 0, z: 0, twist: 0, state: RIBBON_STATE.ACTIVE },
    { id: 'b', chapter: 'flow', x: 300, pageY: 1400, z: .1, twist: .01, state: RIBBON_STATE.ACTIVE },
    { id: 'c', chapter: 'progress', x: 850, pageY: 2600, z: -.1, twist: -.01, state: RIBBON_STATE.MEMORY },
    { id: 'd', chapter: 'cta', x: 500, pageY: 4300, z: 0, twist: 0, state: RIBBON_STATE.ACTIVE },
  ],
}

test('creates stable full geometry with normalized path progress', () => {
  const geometry = createRibbonGeometry({ layout, segments: 12 })
  const pathU = geometry.getAttribute('pathU')
  assert.equal(pathU.getX(0), 0)
  assert.equal(pathU.getX(pathU.count - 1), 1)
  assert.equal(geometry.drawRange.start, 0)
  assert.ok(Number.isFinite(geometry.drawRange.count))
  assert.ok(geometry.drawRange.count < geometry.index.count)
})

test('keeps a constant ribbon width across the complete path', () => {
  const geometry = createRibbonGeometry({ layout, segments: 12 })
  const positions = geometry.getAttribute('position')
  const verticesPerRow = RIBBON_WIDTH_SEGMENTS + 1
  for (let row = 0; row <= 12; row += 1) {
    const left = row * verticesPerRow
    const right = left + RIBBON_WIDTH_SEGMENTS
    const dx = positions.getX(left) - positions.getX(right)
    const dy = positions.getY(left) - positions.getY(right)
    const dz = positions.getZ(left) - positions.getZ(right)
    const width = Math.hypot(dx, dy, dz)
    assert.ok(Math.abs(width - layout.profile.ribbonWidth) < 1e-5)
    assert.ok(Math.hypot(dx, dy) >= layout.profile.ribbonWidth * .98)
  }
})

test('subdivides the ribbon width without creating another mesh', () => {
  const geometry = createRibbonGeometry({ layout, segments: 12 })
  assert.equal(geometry.userData.widthSegments, 8)
  assert.equal(geometry.getAttribute('position').count, 13 * 9)
  assert.equal(geometry.index.count, 12 * 8 * 6)
})

test('reveals one continuous head segment with a shared transverse progress', () => {
  const reveal = getRibbonRevealState(.237, 100)
  assert.equal(reveal.headSegment, 23)
  assert.ok(Math.abs(reveal.headProgress - .7) < 1e-10)
  assert.equal(reveal.headStartU, .23)
  assert.equal(reveal.drawCount, 24 * RIBBON_WIDTH_SEGMENTS * 6)
})

test('stores the previous transverse row for a straight interpolated head', () => {
  const geometry = createRibbonGeometry({ layout, segments: 12 })
  const positions = geometry.getAttribute('position')
  const previous = geometry.getAttribute('aPreviousPosition')
  const verticesPerRow = RIBBON_WIDTH_SEGMENTS + 1
  for (let widthIndex = 0; widthIndex < verticesPerRow; widthIndex += 1) {
    const current = verticesPerRow + widthIndex
    assert.equal(previous.getX(current), positions.getX(widthIndex))
    assert.equal(previous.getY(current), positions.getY(widthIndex))
    assert.equal(previous.getZ(current), positions.getZ(widthIndex))
  }
})
