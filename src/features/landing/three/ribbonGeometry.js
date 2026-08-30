import {
  BufferAttribute,
  BufferGeometry,
  Vector3,
} from 'three'
import { getFinalCompletionScroll, getRibbonSegmentCount } from './ribbonProfiles.js'
import {
  createTransportedFrames,
  getCenterlineChecksum,
  getRibbonCurveMetrics,
  MonotoneRibbonCurve,
} from './ribbonPath.js'

export const RIBBON_WORLD_HEIGHT = 7.2
export const RIBBON_WIDTH_SEGMENTS = 8

export function getRibbonRevealState(reveal, segments, widthSegments = RIBBON_WIDTH_SEGMENTS) {
  const safeSegments = Math.max(1, segments)
  const scaled = Math.max(0, Math.min(1, reveal)) * safeSegments
  const headSegment = Math.min(safeSegments - 1, Math.floor(scaled))
  const headProgress = reveal >= 1 ? 1 : scaled - headSegment
  const visibleSegments = reveal >= 1 ? safeSegments : headSegment + 1
  return {
    drawCount: visibleSegments * widthSegments * 6,
    headProgress,
    headSegment,
    headStartU: headSegment / safeSegments,
  }
}

function collectControlPoints(layout) {
  if (!layout?.waypoints?.length || !layout.viewportHeight || !layout.viewportWidth) return null

  const worldWidth = RIBBON_WORLD_HEIGHT * (layout.viewportWidth / layout.viewportHeight)
  const points = []
  const twists = []
  const states = []
  const pageYs = []

  layout.waypoints.forEach((waypoint) => {
    const worldX = (waypoint.x / layout.viewportWidth - .5) * worldWidth
    const worldY = RIBBON_WORLD_HEIGHT * .5
      - (waypoint.pageY / layout.viewportHeight) * RIBBON_WORLD_HEIGHT
    points.push(new Vector3(
      worldX,
      worldY,
      waypoint.z * layout.profile.depthScale,
    ))
    twists.push(waypoint.twist * layout.profile.twistScale)
    states.push(waypoint.state)
    pageYs.push(waypoint.pageY)
  })

  return points.length > 3 ? { points, twists, states, pageYs } : null
}

function interpolate(values, progress) {
  const scaled = Math.max(0, Math.min(1, progress)) * (values.length - 1)
  const from = Math.floor(scaled)
  const to = Math.min(values.length - 1, from + 1)
  const amount = scaled - from
  return values[from] + (values[to] - values[from]) * amount
}

function findControlProgresses(curve, controls, segments) {
  const divisions = Math.max(200, segments)
  curve.arcLengthDivisions = divisions
  curve.updateArcLengths()
  const arcLengths = curve.getLengths()
  const totalLength = Math.max(Number.EPSILON, arcLengths.at(-1))

  return controls.pageYs.map((pageY) => {
    const pageProgress = Math.max(0, Math.min(
      1,
      (pageY - curve.startPageY) / curve.pageSpan,
    ))
    const scaled = pageProgress * divisions
    const lower = Math.floor(scaled)
    const upper = Math.min(divisions, lower + 1)
    const amount = scaled - lower
    const lengthAtPageY = arcLengths[lower]
      + (arcLengths[upper] - arcLengths[lower]) * amount
    return lengthAtPageY / totalLength
  })
}

function createTimeline(layout, controlProgresses) {
  const initialReveal = .02
  const completionScroll = getFinalCompletionScroll(layout)
  const getRevealOffset = (waypoint) => {
    const sectionY = Number.isFinite(waypoint.sectionY) ? waypoint.sectionY : 0
    if (waypoint.chapter === 'hero') return .02 + Math.max(0, sectionY) * .2
    if (waypoint.chapter === 'flow') return .08 + Math.max(0, sectionY) * .52
    if (waypoint.chapter === 'progress') return .18 + Math.max(0, sectionY) * .42
    return .58
  }
  const ctaWaypoints = layout.waypoints.filter(
    (waypoint) => waypoint.chapter === 'cta' && Number.isFinite(waypoint.sectionY),
  )
  const ctaSectionStart = ctaWaypoints[0]?.sectionY
  const ctaSectionEnd = ctaWaypoints.at(-1)?.sectionY
  const ctaRevealStart = ctaWaypoints.length > 1
    ? Math.max(0, ctaWaypoints[0].pageY - layout.viewportHeight * .58)
    : completionScroll
  const stops = layout.waypoints.map((waypoint, index) => {
    const defaultScroll = Math.max(
      0,
      waypoint.pageY - layout.viewportHeight * getRevealOffset(waypoint),
    )
    const ctaProgress = waypoint.chapter === 'cta'
      && Number.isFinite(waypoint.sectionY)
      && Number.isFinite(ctaSectionStart)
      && Number.isFinite(ctaSectionEnd)
      ? Math.max(0, Math.min(1,
        (waypoint.sectionY - ctaSectionStart)
        / Math.max(.001, ctaSectionEnd - ctaSectionStart),
      ))
      : null
    const scrollY = ctaProgress === null
      ? defaultScroll
      : ctaRevealStart + (completionScroll - ctaRevealStart) * ctaProgress

    return {
      id: waypoint.id,
      chapter: waypoint.chapter,
      scrollY,
      pathU: controlProgresses[index],
    }
  }).filter((_, index) => !layout.waypoints[index].steering)

  stops[0] = { ...stops[0], scrollY: 0, pathU: initialReveal }
  stops[stops.length - 1] = {
    ...stops[stops.length - 1],
    scrollY: completionScroll,
    pathU: 1,
  }

  const minimumStopSpan = Math.min(
    Math.max(24, layout.viewportHeight * .03),
    completionScroll / Math.max(1, stops.length - 1),
  )
  let previousScroll = 0
  let previousPathU = initialReveal
  const normalizedStops = stops.map((stop, index) => {
    const remaining = stops.length - index - 1
    const latestAllowed = completionScroll - remaining * minimumStopSpan
    const scrollY = index === 0
      ? 0
      : index === stops.length - 1
        ? completionScroll
        : Math.min(latestAllowed, Math.max(previousScroll + minimumStopSpan, stop.scrollY))
    const pathU = index === 0 ? initialReveal : Math.max(previousPathU, stop.pathU)
    previousScroll = scrollY
    previousPathU = pathU
    return { ...stop, scrollY, pathU }
  })

  normalizedStops.at(-1).scrollY = completionScroll
  normalizedStops.at(-1).pathU = 1

  const chapterRanges = {}
  normalizedStops.forEach((stop) => {
    const range = chapterRanges[stop.chapter]
    if (!range) chapterRanges[stop.chapter] = { start: stop.pathU, end: stop.pathU }
    else range.end = stop.pathU
  })

  return {
    initialReveal,
    completionScroll: normalizedStops.at(-1).scrollY,
    chapterRanges,
    stops: normalizedStops,
  }
}

export function createRibbonGeometry({ layout, segments = getRibbonSegmentCount(layout) }) {
  const controls = collectControlPoints(layout)
  if (!controls) return new BufferGeometry()

  const curve = new MonotoneRibbonCurve(controls.points, controls.pageYs)
  const controlProgresses = findControlProgresses(curve, controls, segments)
  const controlProgressById = Object.fromEntries(
    layout.waypoints.map((waypoint, index) => [waypoint.id, controlProgresses[index]]),
  )
  const frames = createTransportedFrames(
    curve,
    segments,
    (pathU) => interpolate(controls.twists, pathU),
  )
  const verticesPerRow = RIBBON_WIDTH_SEGMENTS + 1
  const vertexCount = (segments + 1) * verticesPerRow
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const previousPositions = new Float32Array(vertexCount * 3)
  const pathProgress = new Float32Array(vertexCount)
  const sides = new Float32Array(vertexCount)
  const states = new Float32Array(vertexCount)
  const indices = new Uint32Array(segments * RIBBON_WIDTH_SEGMENTS * 6)

  const point = new Vector3()
  const vertexPosition = new Vector3()

  for (let index = 0; index <= segments; index += 1) {
    const pathU = index / segments
    curve.getPointAt(pathU, point)
    const { side, normal } = frames[index]

    const state = interpolate(controls.states, pathU)
    for (let widthIndex = 0; widthIndex <= RIBBON_WIDTH_SEGMENTS; widthIndex += 1) {
      const sideAmount = 1 - (widthIndex / RIBBON_WIDTH_SEGMENTS) * 2
      const vertexIndex = index * verticesPerRow + widthIndex
      const vertexOffset = vertexIndex * 3
      vertexPosition.copy(point).addScaledVector(
        side,
        sideAmount * layout.profile.ribbonWidth * .5,
      )
      positions.set([vertexPosition.x, vertexPosition.y, vertexPosition.z], vertexOffset)
      normals.set([normal.x, normal.y, normal.z], vertexOffset)
      pathProgress[vertexIndex] = pathU
      sides[vertexIndex] = sideAmount
      states[vertexIndex] = state
    }
  }

  for (let row = 0; row <= segments; row += 1) {
    const previousRow = Math.max(0, row - 1)
    for (let widthIndex = 0; widthIndex <= RIBBON_WIDTH_SEGMENTS; widthIndex += 1) {
      const vertexIndex = row * verticesPerRow + widthIndex
      const previousVertexIndex = previousRow * verticesPerRow + widthIndex
      const vertexOffset = vertexIndex * 3
      const previousOffset = previousVertexIndex * 3
      previousPositions[vertexOffset] = positions[previousOffset]
      previousPositions[vertexOffset + 1] = positions[previousOffset + 1]
      previousPositions[vertexOffset + 2] = positions[previousOffset + 2]
    }
  }

  for (let index = 0; index < segments; index += 1) {
    for (let widthIndex = 0; widthIndex < RIBBON_WIDTH_SEGMENTS; widthIndex += 1) {
      const current = index * verticesPerRow + widthIndex
      const next = current + verticesPerRow
      const indexOffset = (index * RIBBON_WIDTH_SEGMENTS + widthIndex) * 6
      indices.set([
        current,
        next,
        current + 1,
        next,
        next + 1,
        current + 1,
      ], indexOffset)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('aPreviousPosition', new BufferAttribute(previousPositions, 3))
  geometry.setAttribute('pathU', new BufferAttribute(pathProgress, 1))
  geometry.setAttribute('aSide', new BufferAttribute(sides, 1))
  geometry.setAttribute('aState', new BufferAttribute(states, 1))
  geometry.setIndex(new BufferAttribute(indices, 1))
  geometry.computeBoundingSphere()
  geometry.userData.curve = curve
  geometry.userData.segments = segments
  geometry.userData.widthSegments = RIBBON_WIDTH_SEGMENTS
  geometry.userData.timeline = createTimeline(
    layout,
    controlProgresses,
  )
  const initialRevealState = getRibbonRevealState(
    geometry.userData.timeline.initialReveal,
    segments,
  )
  geometry.setDrawRange(0, initialRevealState.drawCount)
  geometry.userData.layoutSignature = layout.signature
  geometry.userData.centerlineChecksum = getCenterlineChecksum(curve)
  geometry.userData.frames = frames
  geometry.userData.controlProgressById = controlProgressById
  const heroStart = controlProgressById['hero-entry'] ?? 0
  const heroEnd = controlProgressById['hero-exit'] ?? 1
  const heroStartIndex = Math.floor(heroStart * segments)
  const heroEndIndex = Math.ceil(heroEnd * segments)
  geometry.userData.heroMetrics = {
    ...getRibbonCurveMetrics(curve, heroStart, heroEnd),
    minProjectedWidthRatio: frames
      .slice(heroStartIndex, heroEndIndex + 1)
      .reduce((minimum, frame) => Math.min(
        minimum,
        Math.hypot(frame.side.x, frame.side.y),
      ), 1),
  }
  return geometry
}
