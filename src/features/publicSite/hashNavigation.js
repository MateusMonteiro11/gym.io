export const SMOOTH_HASH_NAVIGATION = 'gymio:smooth-hash'

export function getSmoothHashState(state) {
  const currentState = state && typeof state === 'object' ? state : {}
  return { ...currentState, hashNavigation: SMOOTH_HASH_NAVIGATION }
}

export function shouldAnimateHashNavigation({ navigationType, state, reducedMotion }) {
  return navigationType === 'PUSH'
    && state?.hashNavigation === SMOOTH_HASH_NAVIGATION
    && !reducedMotion
}
