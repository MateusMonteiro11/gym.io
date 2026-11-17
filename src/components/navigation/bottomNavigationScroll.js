export function getBottomNavigationScrollState(previous, scrollY, maxScroll) {
  const limit = Math.max(0, maxScroll)
  const position = Math.max(0, Math.min(scrollY, limit))

  if (limit <= 1 || position <= 24) {
    return { position, anchor: position, hidden: false }
  }

  const previousAnchor = Math.max(0, Math.min(previous.anchor, limit))
  const anchor = previous.hidden
    ? Math.max(previousAnchor, position)
    : Math.min(previousAnchor, position)
  const toggle = previous.hidden ? anchor - position >= 8 : position - anchor >= 16

  return {
    position,
    anchor: toggle ? position : anchor,
    hidden: toggle ? !previous.hidden : previous.hidden,
  }
}
