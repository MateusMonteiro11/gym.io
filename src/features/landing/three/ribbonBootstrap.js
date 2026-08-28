export const RIBBON_BOOTSTRAP_REASON = Object.freeze({
  INITIAL_LOAD: 'INITIAL_LOAD',
  PAGE_SHOW: 'PAGE_SHOW',
  HASH_CHANGE: 'HASH_CHANGE',
  POPSTATE: 'POPSTATE',
  FONT_READY: 'FONT_READY',
  LAYOUT_INVALIDATION: 'LAYOUT_INVALIDATION',
  RESIZE: 'RESIZE',
})

export function getRibbonScrollSnapshot(scrollY, rootTop, maxScroll, time, previous) {
  const rawScroll = Math.max(0, Math.min(maxScroll, scrollY - rootTop))
  const elapsed = Math.max(1, time - (previous?.time ?? time))
  const delta = rawScroll - (previous?.position ?? rawScroll)
  return {
    rawScroll,
    progress: maxScroll > 0 ? rawScroll / maxScroll : 0,
    rawVelocity: previous?.initialized ? (delta / elapsed) * 1000 : 0,
    lastInputTime: time,
    initialized: true,
  }
}

export function shouldRecoverFragment({ hash, scrollY, target }) {
  return Boolean(hash && target && scrollY <= 1)
}

export function nextLayoutEpoch(previousSignature, nextSignature, epoch) {
  return previousSignature === nextSignature ? epoch : epoch + 1
}
