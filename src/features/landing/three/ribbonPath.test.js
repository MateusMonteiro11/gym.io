import assert from 'node:assert/strict'
import test from 'node:test'
import { Vector3 } from 'three'
import {
  createTransportedFrames,
  getRibbonCurveMetrics,
  MonotoneRibbonCurve,
} from './ribbonPath.js'

function createHeroCurve() {
  return new MonotoneRibbonCurve([
    new Vector3(3.7, 5.6, -.08),
    new Vector3(2.7, 3.9, -.04),
    new Vector3(1.55, 2.3, 0),
    new Vector3(.85, .7, .02),
    new Vector3(1.45, -2.2, 0),
  ], [-250, -36, 162, 396, 684])
}

test('keeps the Hero centerline curved without becoming oscillatory', () => {
  const metrics = getRibbonCurveMetrics(createHeroCurve(), 0, 1, 180)
  assert.ok(metrics.lateralSpan > 2)
  assert.ok(metrics.totalTurningAngle > .2)
  assert.ok(metrics.reversals <= 1)
  assert.ok(metrics.maximumTangentStep < .11)
})

test('parallel transport does not accumulate authored twist', () => {
  const frames = createTransportedFrames(createHeroCurve(), 180, () => .02)
  frames.forEach(({ baseSide, side }) => {
    assert.ok(baseSide.angleTo(side) <= .02001)
    assert.ok(Math.hypot(side.x, side.y) >= .98)
  })
  for (let index = 1; index < frames.length; index += 1) {
    assert.ok(frames[index - 1].baseSide.dot(frames[index].baseSide) > 0)
  }
})
