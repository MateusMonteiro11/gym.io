export const EFFECT_VELOCITY_LIMIT = 1800
export const EFFECT_DEAD_ZONE = 8
export const EFFECT_TIME_CONSTANT = .08

export function clampEffectVelocity(velocity) {
  return Math.max(-EFFECT_VELOCITY_LIMIT, Math.min(EFFECT_VELOCITY_LIMIT, velocity))
}

export function getEffectTarget(snapshot, now) {
  if (now - snapshot.lastInputTime > 32) return 0
  return clampEffectVelocity(snapshot.rawVelocity)
}

export function stepEffectChannel(current, target, delta) {
  const alpha = 1 - Math.exp(-Math.max(0, delta) / EFFECT_TIME_CONSTANT)
  const velocity = current.velocity + (target - current.velocity) * alpha
  if (Math.abs(velocity) < EFFECT_DEAD_ZONE && target === 0) {
    return { velocity: 0, direction: current.direction || 1, strength: 0, idle: true }
  }
  const direction = Math.abs(velocity) >= EFFECT_DEAD_ZONE
    ? Math.sign(velocity)
    : current.direction || 1
  return {
    velocity,
    direction,
    strength: Math.min(1, Math.abs(velocity) / 900),
    idle: Math.abs(velocity) < EFFECT_DEAD_ZONE,
  }
}
