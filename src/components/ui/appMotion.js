export const APP_EASE = [0.16, 1, 0.3, 1]
export const APP_DURATION = 0.22

export function appEntrance(reducedMotion, index = 0) {
  return {
    initial: reducedMotion ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reducedMotion ? 0 : APP_DURATION,
      delay: reducedMotion ? 0 : Math.min(Math.max(index, 0) * 0.055, 0.165),
      ease: APP_EASE,
    },
  }
}
