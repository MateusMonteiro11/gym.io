import { Curve, Quaternion, Vector3 } from 'three'

export const RIBBON_MAX_LATERAL_SLOPE = .75
export const RIBBON_MAX_TANGENT_STEP = Math.PI / 30

const EPSILON = 1e-6
const transportRotation = new Quaternion()
const transportAxis = new Vector3()
const viewAxis = new Vector3(0, 0, 1)
const screenSide = new Vector3()

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function getPchipSlopes(axis, values) {
  const count = axis.length
  if (count < 2) return new Float64Array(count)
  const spans = new Float64Array(count - 1)
  const secants = new Float64Array(count - 1)
  for (let index = 0; index < count - 1; index += 1) {
    spans[index] = Math.max(EPSILON, axis[index + 1] - axis[index])
    secants[index] = (values[index + 1] - values[index]) / spans[index]
  }

  const slopes = new Float64Array(count)
  slopes[0] = secants[0]
  slopes[count - 1] = secants[count - 2]
  for (let index = 1; index < count - 1; index += 1) {
    const previous = secants[index - 1]
    const next = secants[index]
    if (previous === 0 || next === 0 || Math.sign(previous) !== Math.sign(next)) {
      slopes[index] = 0
      continue
    }
    const previousWeight = 2 * spans[index] + spans[index - 1]
    const nextWeight = spans[index] + 2 * spans[index - 1]
    slopes[index] = (previousWeight + nextWeight)
      / (previousWeight / previous + nextWeight / next)
  }
  return slopes
}

function evaluateHermite(axis, values, slopes, value) {
  if (value <= axis[0]) return values[0]
  if (value >= axis.at(-1)) return values.at(-1)
  let upper = 1
  while (upper < axis.length && value > axis[upper]) upper += 1
  const lower = upper - 1
  const span = Math.max(EPSILON, axis[upper] - axis[lower])
  const t = (value - axis[lower]) / span
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  return h00 * values[lower]
    + h10 * span * slopes[lower]
    + h01 * values[upper]
    + h11 * span * slopes[upper]
}

export class MonotoneRibbonCurve extends Curve {
  constructor(points, pageYs) {
    super()
    this.points = points.map((point) => point.clone())
    this.pageYs = Float64Array.from(pageYs)
    this.startPageY = this.pageYs[0]
    this.endPageY = this.pageYs.at(-1)
    this.pageSpan = Math.max(EPSILON, this.endPageY - this.startPageY)
    this.xValues = Float64Array.from(points, ({ x }) => x)
    this.yValues = Float64Array.from(points, ({ y }) => y)
    this.zValues = Float64Array.from(points, ({ z }) => z)
    this.xSlopes = getPchipSlopes(this.pageYs, this.xValues)
    this.ySlopes = getPchipSlopes(this.pageYs, this.yValues)
    this.zSlopes = getPchipSlopes(this.pageYs, this.zValues)
  }

  getPoint(t, target = new Vector3()) {
    const pageY = this.startPageY + clamp(t, 0, 1) * this.pageSpan
    return target.set(
      evaluateHermite(this.pageYs, this.xValues, this.xSlopes, pageY),
      evaluateHermite(this.pageYs, this.yValues, this.ySlopes, pageY),
      evaluateHermite(this.pageYs, this.zValues, this.zSlopes, pageY),
    )
  }
}

export function resolveRibbonCorridors(waypoints, chapters, viewportWidth, viewportHeight) {
  const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]))
  const resolved = []
  const byId = new Map()
  const minimumGap = Math.max(96, viewportHeight * .12)
  const reversalGap = viewportHeight * .35
  let previousDirection = 0
  let distanceSinceDirectionChange = Number.POSITIVE_INFINITY

  waypoints.forEach((waypoint, index) => {
    const chapter = chapterMap.get(waypoint.chapter)
    const previous = resolved.at(-1)
    const requestedFloor = Number.isFinite(waypoint.minSectionY) && chapter
      ? chapter.top + chapter.height * waypoint.minSectionY
      : Number.NEGATIVE_INFINITY
    const afterPoint = waypoint.minAfter ? byId.get(waypoint.minAfter) : null
    let targetY = Math.max(
      waypoint.pageY,
      requestedFloor,
      afterPoint ? afterPoint.pageY + minimumGap : Number.NEGATIVE_INFINITY,
      previous ? previous.pageY + minimumGap : waypoint.pageY,
    )

    const minimumX = (waypoint.minX ?? .05) * viewportWidth
    const maximumX = (waypoint.maxX ?? .95) * viewportWidth
    const preferredX = clamp(waypoint.x, minimumX, maximumX)
    let x = preferredX

    if (previous) {
      const deltaY = targetY - previous.pageY
      const maximumDeltaX = deltaY * RIBBON_MAX_LATERAL_SLOPE
      x = clamp(preferredX, previous.x - maximumDeltaX, previous.x + maximumDeltaX)
      x = clamp(x, minimumX, maximumX)

      let direction = Math.sign(x - previous.x)
      distanceSinceDirectionChange += deltaY
      if (previousDirection && direction && direction !== previousDirection
        && distanceSinceDirectionChange < reversalGap) {
        x = clamp(previous.x, minimumX, maximumX)
        direction = Math.sign(x - previous.x)
      }
      if (direction && direction !== previousDirection) distanceSinceDirectionChange = 0
      if (direction) previousDirection = direction

      const requiredGap = Math.abs(x - previous.x) / RIBBON_MAX_LATERAL_SLOPE
      targetY = Math.max(targetY, previous.pageY + requiredGap)
    }

    const next = {
      ...waypoint,
      targetY,
      preferredX,
      pageY: targetY,
      x,
      corridor: { minX: minimumX, maxX: maximumX },
      semanticIndex: index,
    }
    resolved.push(next)
    byId.set(next.id, next)
  })

  return resolved
}

export function createTransportedFrames(curve, segments, twistAt) {
  const frames = []
  const previousTangent = new Vector3()
  const previousBaseSide = new Vector3()
  const tangent = new Vector3()
  const baseSide = new Vector3()
  const side = new Vector3()
  const normal = new Vector3()

  for (let index = 0; index <= segments; index += 1) {
    const pathU = index / segments
    curve.getTangentAt(pathU, tangent).normalize()
    if (index === 0) {
      baseSide.crossVectors(tangent, viewAxis)
      if (baseSide.lengthSq() < EPSILON) baseSide.set(1, 0, 0)
      baseSide.normalize()
    } else {
      transportRotation.setFromUnitVectors(previousTangent, tangent)
      baseSide.copy(previousBaseSide).applyQuaternion(transportRotation)
      baseSide.addScaledVector(tangent, -baseSide.dot(tangent))
      if (baseSide.lengthSq() < EPSILON) {
        transportAxis.crossVectors(tangent, viewAxis)
        baseSide.copy(transportAxis.lengthSq() < EPSILON ? previousBaseSide : transportAxis)
      }
      baseSide.normalize()
      if (baseSide.dot(previousBaseSide) < 0) baseSide.multiplyScalar(-1)
    }

    if (Math.hypot(baseSide.x, baseSide.y) < .995) {
      screenSide.crossVectors(tangent, viewAxis)
      if (screenSide.lengthSq() >= EPSILON) {
        screenSide.normalize()
        if (screenSide.dot(baseSide) < 0) screenSide.multiplyScalar(-1)
        baseSide.lerp(screenSide, .65)
        baseSide.addScaledVector(tangent, -baseSide.dot(tangent)).normalize()
      }
    }

    const twist = twistAt(pathU)
    transportRotation.setFromAxisAngle(tangent, twist)
    side.copy(baseSide).applyQuaternion(transportRotation).normalize()
    normal.crossVectors(tangent, side).normalize()
    if (normal.dot(viewAxis) < 0) normal.multiplyScalar(-1)

    frames.push({
      tangent: tangent.clone(),
      baseSide: baseSide.clone(),
      side: side.clone(),
      normal: normal.clone(),
    })
    previousTangent.copy(tangent)
    previousBaseSide.copy(baseSide)
  }
  return frames
}

export function getRibbonCurveMetrics(curve, startU = 0, endU = 1, samples = 96) {
  const safeStart = clamp(startU, 0, 1)
  const safeEnd = clamp(Math.max(safeStart, endU), 0, 1)
  const point = new Vector3()
  const previousPoint = new Vector3()
  const tangent = new Vector3()
  const previousTangent = new Vector3()
  let minimumX = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let totalTurningAngle = 0
  let maximumTangentStep = 0
  const sampledX = []

  for (let index = 0; index <= samples; index += 1) {
    const pathU = safeStart + (safeEnd - safeStart) * (index / samples)
    curve.getPointAt(pathU, point)
    curve.getTangentAt(pathU, tangent).normalize()
    sampledX.push(point.x)
    minimumX = Math.min(minimumX, point.x)
    maximumX = Math.max(maximumX, point.x)
    if (index > 0) {
      const angle = previousTangent.angleTo(tangent)
      totalTurningAngle += angle
      maximumTangentStep = Math.max(maximumTangentStep, angle)
    }
    previousPoint.copy(point)
    previousTangent.copy(tangent)
  }

  // Count only authored, composition-scale turns. Monotone Hermite segments can
  // produce sub-pixel derivative sign changes around a flat extremum; treating
  // those as a second gesture made the tablet QA metric disagree with the
  // visibly single, broad Hero arc.
  const reversalThreshold = Math.max(EPSILON, (maximumX - minimumX) * .01)
  let reversals = 0
  let direction = 0
  let referenceX = sampledX[0] ?? 0
  let extremumX = referenceX
  for (let index = 1; index < sampledX.length; index += 1) {
    const currentX = sampledX[index]
    if (!direction) {
      if (Math.abs(currentX - referenceX) >= reversalThreshold) {
        direction = Math.sign(currentX - referenceX)
        extremumX = currentX
      }
      continue
    }
    if (direction > 0) {
      extremumX = Math.max(extremumX, currentX)
      if (extremumX - currentX >= reversalThreshold) {
        reversals += 1
        direction = -1
        referenceX = extremumX
        extremumX = currentX
      }
    } else {
      extremumX = Math.min(extremumX, currentX)
      if (currentX - extremumX >= reversalThreshold) {
        reversals += 1
        direction = 1
        referenceX = extremumX
        extremumX = currentX
      }
    }
  }

  return {
    lateralSpan: maximumX - minimumX,
    maximumTangentStep,
    reversals,
    totalTurningAngle,
  }
}

export function getCenterlineChecksum(curve, samples = 96) {
  const point = new Vector3()
  let hash = 2166136261
  for (let index = 0; index <= samples; index += 1) {
    curve.getPointAt(index / samples, point)
    const values = [point.x, point.y, point.z]
    values.forEach((value) => {
      const quantized = Math.round(value * 10000)
      hash ^= quantized
      hash = Math.imul(hash, 16777619)
    })
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
