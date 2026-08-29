import { Vector3 } from 'three'
import { ribbonDataAnchors } from './ribbonChapters.js'
import { RIBBON_WORLD_HEIGHT } from './ribbonGeometry.js'

const point = new Vector3()

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function overlapArea(first, second) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
  return width * height
}

function rectFromCenter(x, y, width, height) {
  return {
    left: x - width * .5,
    right: x + width * .5,
    top: y - height * .5,
    bottom: y + height * .5,
    width,
    height,
  }
}

function getPagePoint(curve, pathU, layout) {
  curve.getPointAt(pathU, point)
  const worldWidth = RIBBON_WORLD_HEIGHT * (layout.viewportWidth / layout.viewportHeight)
  return {
    x: (point.x / worldWidth + .5) * layout.viewportWidth,
    y: ((RIBBON_WORLD_HEIGHT * .5 - point.y) / RIBBON_WORLD_HEIGHT) * layout.viewportHeight,
  }
}

function findPathUForPageY(curve, layout, targetPageY, segments) {
  let closestU = 0
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index <= segments; index += 1) {
    const pathU = index / segments
    const pagePoint = getPagePoint(curve, pathU, layout)
    const distance = Math.abs(pagePoint.y - targetPageY)
    if (distance < closestDistance) {
      closestDistance = distance
      closestU = pathU
    }
  }
  return closestU
}

function scoreCandidate(rect, exclusions, placed) {
  const exclusionPenalty = exclusions.reduce(
    (total, exclusion) => total + overlapArea(rect, exclusion) * 12,
    0,
  )
  const anchorPenalty = placed.reduce(
    (total, anchor) => total + overlapArea(rect, anchor.rect) * 18,
    0,
  )
  return exclusionPenalty + anchorPenalty
}

export function createRibbonDataAnchorLayout(layout, geometry, measurements) {
  if (!geometry?.userData?.curve || !measurements?.hero) return []
  if (layout.viewportWidth <= 720) {
    return ribbonDataAnchors.map((anchor) => ({ ...anchor, mode: anchor.mobileBehavior }))
  }

  const curve = geometry.userData.curve
  const frames = geometry.userData.frames
  const segments = geometry.userData.segments
  const controlProgressById = geometry.userData.controlProgressById ?? {}
  const waypointById = new Map(layout.waypoints.map((waypoint) => [waypoint.id, waypoint]))
  const scaleX = layout.viewportWidth
    / (RIBBON_WORLD_HEIGHT * (layout.viewportWidth / layout.viewportHeight))
  const scaleY = layout.viewportHeight / RIBBON_WORLD_HEIGHT
  const margin = layout.profile.key === 'tablet' ? 20 : 28
  const placed = []

  ribbonDataAnchors.forEach((definition) => {
    const measurement = measurements.nodes[definition.id]
    const waypoint = waypointById.get(definition.waypointId)
    const waypointU = controlProgressById[definition.waypointId]
    if (!measurement || !waypoint || !Number.isFinite(waypointU)) return

    const targetPageY = waypoint.pageY + (definition.pageOffsetY ?? 0)
    const pathU = definition.pageOffsetY
      ? findPathUForPageY(curve, layout, targetPageY, segments)
      : waypointU
    const frameIndex = Math.round(pathU * segments)
    const frame = frames[frameIndex]
    const centerline = getPagePoint(curve, pathU, layout)
    const sideX = frame.side.x * scaleX
    const sideY = -frame.side.y * scaleY
    const sideLength = Math.max(.0001, Math.hypot(sideX, sideY))
    const normalizedSide = { x: sideX / sideLength, y: sideY / sideLength }
    const projectedHalfWidth = layout.profile.ribbonWidth * sideLength * .5
    const distance = projectedHalfWidth + definition.clearancePx
    const horizontalDirection = definition.preferredSide === 'right' ? 1 : -1
    const preferredSign = Math.sign(normalizedSide.x || 1) === horizontalDirection ? 1 : -1
    const exclusions = definition.collisionSelectors
      .map((selector) => measurements.exclusions[selector])
      .filter(Boolean)

    const candidates = [preferredSign, -preferredSign].map((sign, index) => {
      const candidateSide = index === 0
        ? definition.preferredSide
        : definition.preferredSide === 'right' ? 'left' : 'right'
      const rawY = centerline.y + normalizedSide.y * distance * sign
      const comparisonU = findPathUForPageY(curve, layout, rawY, segments)
      const comparisonPoint = getPagePoint(curve, comparisonU, layout)
      const lateralBoundary = projectedHalfWidth + definition.clearancePx
      const lateralX = candidateSide === 'right'
        ? comparisonPoint.x + lateralBoundary
        : comparisonPoint.x - lateralBoundary
      const frameX = centerline.x + normalizedSide.x * distance * sign
      const rawX = candidateSide === 'right'
        ? Math.max(frameX, lateralX)
        : Math.min(frameX, lateralX)
      const x = clamp(
        rawX,
        margin + measurement.width * .5,
        layout.viewportWidth - margin - measurement.width * .5,
      )
      const y = clamp(
        rawY,
        measurements.hero.top + margin + measurement.height * .5,
        measurements.hero.bottom - margin - measurement.height * .5,
      )
      const rect = rectFromCenter(x, y, measurement.width, measurement.height)
      return {
        x,
        y,
        rect,
        side: candidateSide,
        score: scoreCandidate(rect, exclusions, placed) + index,
      }
    })
    candidates.sort((first, second) => first.score - second.score)
    const selected = candidates[0]
    placed.push({
      ...definition,
      mode: 'path',
      pageX: selected.x,
      pageY: selected.y,
      heroX: selected.x,
      heroY: selected.y - measurements.hero.top,
      pathU,
      rect: selected.rect,
      side: selected.side,
    })
  })

  return placed
}

export function getRibbonDataAnchorChecksum(anchors) {
  return anchors.map(({ id, heroX, heroY, pathU, mode }) => [
    id,
    mode,
    Number.isFinite(heroX) ? Math.round(heroX * 10) : '-',
    Number.isFinite(heroY) ? Math.round(heroY * 10) : '-',
    Number.isFinite(pathU) ? pathU.toFixed(5) : '-',
  ].join(':')).join('|')
}
