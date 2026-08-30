import assert from 'node:assert/strict'
import test from 'node:test'
import { ribbonWaypoints } from './ribbonChapters.js'

test('keeps the CTA departure gradual and directed beyond the final section', () => {
  const tail = ribbonWaypoints.filter(
    (waypoint) => waypoint.chapter === 'cta' && waypoint.sectionY >= .78,
  )

  assert.deepEqual(tail.map(({ id }) => id), [
    'cta-lower',
    'cta-departure',
    'cta-divider',
    'cta-hidden-tail',
  ])

  for (let index = 1; index < tail.length; index += 1) {
    const horizontalStep = tail[index].viewportX - tail[index - 1].viewportX
    assert.ok(horizontalStep > 0)
    assert.ok(horizontalStep <= .12)
    assert.ok(tail[index].sectionY > tail[index - 1].sectionY)
  }

  assert.ok(tail.at(-1).sectionY > 1)
  assert.equal(tail.at(-1).pageSelector, '.institutional-footer')
  assert.equal(tail.at(-1).anchorY, .45)
  assert.equal(tail.at(-1).twist, 0)
})

test('keeps the physical ribbon origin outside the Hero viewport', () => {
  const origin = ribbonWaypoints.find(({ id }) => id === 'hero-entry')
  assert.ok(origin.sectionY <= -.25)
})

test('keeps the FAQ trail between desktop columns and outside compact copy', () => {
  const faqTrail = ribbonWaypoints.filter(({ chapter }) => chapter === 'faq')
  const ctaEntry = ribbonWaypoints.find(({ id }) => id === 'cta-entry')

  assert.deepEqual(faqTrail.map(({ id }) => id), [
    'faq-entry',
    'faq-center',
    'faq-exit',
    'faq-departure',
  ])

  faqTrail.forEach((waypoint, index) => {
    assert.equal(waypoint.pageSelector, '.faq-heading')
    assert.equal(waypoint.anchorY, [.04, .5, .96, 1.12][index])
    assert.ok(waypoint.tabletX > 1)
    assert.ok(waypoint.mobileX > 1)
  })

  assert.deepEqual(faqTrail.map(({ viewportX }) => viewportX), [.42, .35, .43, .39])
  assert.ok(faqTrail[0].viewportX > faqTrail[1].viewportX)
  assert.ok(faqTrail[2].viewportX > faqTrail[1].viewportX)

  const faqDeparture = faqTrail.at(-1)
  assert.equal(ctaEntry.viewportX, faqDeparture.viewportX)
  assert.equal(ctaEntry.tabletX, faqDeparture.tabletX)
  assert.equal(ctaEntry.mobileX, faqDeparture.mobileX)
  assert.equal(ctaEntry.z, faqDeparture.z)
  assert.equal(ctaEntry.twist, faqDeparture.twist)
})

test('hides the minimum Hero head inside the stable workout-card column', () => {
  const heroExit = ribbonWaypoints.find(({ id }) => id === 'hero-exit')
  const flowEntry = ribbonWaypoints.find(({ id }) => id === 'flow-series-entry')

  assert.match(heroExit.pageSelector, /flow-product-column/)
  assert.match(heroExit.pageSelector, /flow-mobile-step/)
  assert.equal(flowEntry.pageSelector, heroExit.pageSelector)
  assert.ok(heroExit.anchorY > 0 && heroExit.anchorY < flowEntry.anchorY)
  assert.equal(heroExit.twist, 0)
})
