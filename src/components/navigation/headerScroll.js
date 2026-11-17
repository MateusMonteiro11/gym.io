export function getHeaderScrollState(previous, scrollY, maxScroll) {
  const position = Math.max(0, Math.min(scrollY, Math.max(0, maxScroll)))
  const delta = position - previous.position
  if (delta === 0) return previous

  const direction = Math.sign(delta)
  const distance = direction === previous.direction
    ? previous.distance + Math.abs(delta)
    : Math.abs(delta)

  return {
    position,
    direction,
    distance,
    hidden: position <= 48 ? false : distance >= 8 ? direction > 0 : previous.hidden,
  }
}
