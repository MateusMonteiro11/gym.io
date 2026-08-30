import assert from 'node:assert/strict'
import test from 'node:test'
import { getStaticPageTop } from './ribbonLayout.js'

test('measures an anchor relative to its chapter when their offset parent is shared', () => {
  const page = { offsetTop: 0, offsetParent: null }
  const landing = { offsetTop: 100, offsetParent: page }
  const chapter = {
    offsetTop: 7_000,
    offsetParent: landing,
    getBoundingClientRect: () => ({ top: 500 }),
  }
  const heading = {
    offsetTop: 7_200,
    offsetParent: landing,
    closest: () => chapter,
  }

  assert.equal(getStaticPageTop(heading, 100, 6_600), 7_200)
})

test('falls back to the rendered page position outside ribbon chapters', () => {
  const element = {
    closest: () => null,
    getBoundingClientRect: () => ({ top: 240 }),
  }

  assert.equal(getStaticPageTop(element, 80, 1_000), 1_160)
})
