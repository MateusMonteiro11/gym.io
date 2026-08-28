function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

export function mapScrollToRibbonU(scrollY, timeline) {
  const stops = timeline?.stops
  if (!stops?.length) return clamp01(scrollY)
  if (scrollY <= stops[0].scrollY) return stops[0].pathU

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]
    const next = stops[index]
    if (scrollY > next.scrollY) continue
    const progress = clamp01(
      (scrollY - previous.scrollY) / Math.max(1, next.scrollY - previous.scrollY),
    )
    return previous.pathU + (next.pathU - previous.pathU) * progress
  }

  return stops.at(-1).pathU
}

export function getRibbonReveal(state, _layout, timeline) {
  return mapScrollToRibbonU(state.rawScroll, timeline)
}
