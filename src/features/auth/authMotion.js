export const AUTH_EASE = [0.16, 1, 0.3, 1]

export function authEntrance(reducedMotion, y, delay = 0) {
  return {
    initial: reducedMotion ? false : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reducedMotion ? 0 : 0.32, delay: reducedMotion ? 0 : delay, ease: AUTH_EASE },
  }
}
