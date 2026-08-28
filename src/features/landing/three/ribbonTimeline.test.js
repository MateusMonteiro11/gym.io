import assert from 'node:assert/strict'
import test from 'node:test'
import { getRibbonReveal, mapScrollToRibbonU } from './ribbonTimeline.js'

const timeline = {
  initialReveal: .02,
  stops: [
    { chapter: 'hero', scrollY: 0, pathU: .02 },
    { chapter: 'hero', scrollY: 900, pathU: .16 },
    { chapter: 'flow', scrollY: 1000, pathU: .18 },
    { chapter: 'flow', scrollY: 1700, pathU: .3 },
    { chapter: 'flow', scrollY: 2400, pathU: .4 },
    { chapter: 'flow', scrollY: 3000, pathU: .5 },
    { chapter: 'progress', scrollY: 3200, pathU: .52 },
    { chapter: 'progress', scrollY: 4000, pathU: .68 },
    { chapter: 'cta', scrollY: 6150, pathU: 1 },
  ],
}

test('starts with only the active head visible', () => {
  assert.equal(mapScrollToRibbonU(0, timeline), .02)
})

test('advances continuously through series, rest and return', () => {
  const series = mapScrollToRibbonU(1200, timeline)
  const rest = mapScrollToRibbonU(2050, timeline)
  const returning = mapScrollToRibbonU(2800, timeline)
  assert.ok(series > .18)
  assert.ok(rest > series)
  assert.ok(returning > rest)
})

test('starts progress from the previous chapter and grows locally', () => {
  assert.equal(mapScrollToRibbonU(3000, timeline), .5)
  assert.equal(mapScrollToRibbonU(3200, timeline), .52)
  assert.ok(mapScrollToRibbonU(3600, timeline) > .52)
})

test('is deterministic and immediately reversible', () => {
  const forward = getRibbonReveal({ rawScroll: 3650 }, null, timeline)
  const reverse = getRibbonReveal({ rawScroll: 3650 }, null, timeline)
  assert.equal(reverse, forward)
  assert.ok(getRibbonReveal({ rawScroll: 3500 }, null, timeline) < forward)
})

test('continues through the final chapter and remains complete', () => {
  assert.ok(mapScrollToRibbonU(5350, timeline) < 1)
  assert.equal(mapScrollToRibbonU(6150, timeline), 1)
  assert.equal(mapScrollToRibbonU(6200, timeline), 1)
})
