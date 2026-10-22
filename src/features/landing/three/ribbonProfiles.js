const PROFILES = {
  desktop: {
    key: 'desktop', maxDpr: 1.25, ribbonWidth: 1.08, twistScale: 1,
    depthScale: .72, segmentPixels: 14, minSegments: 420, maxSegments: 760,
  },
  tablet: {
    key: 'tablet', maxDpr: 1.15, ribbonWidth: .94, twistScale: .82,
    depthScale: .55, segmentPixels: 13, minSegments: 360, maxSegments: 640,
  },
  mobile: {
    key: 'mobile', maxDpr: 1, ribbonWidth: .76, twistScale: .62,
    depthScale: .32, segmentPixels: 10, minSegments: 300, maxSegments: 560,
  },
  smallMobile: {
    key: 'small-mobile', maxDpr: 1, ribbonWidth: .64, twistScale: .5,
    depthScale: .25, segmentPixels: 9, minSegments: 280, maxSegments: 520,
  },
}

export function getRibbonProfile(viewportWidth) {
  if (viewportWidth <= 380) return PROFILES.smallMobile
  if (viewportWidth <= 720) return PROFILES.mobile
  if (viewportWidth <= 1100) return PROFILES.tablet
  return PROFILES.desktop
}

export function mapPageToScene(pageY) {
  return pageY
}

export function getFinalCompletionScroll(layout) {
  const maxScroll = Math.max(0, (layout?.rootHeight ?? 0) - (layout?.viewportHeight ?? 0))
  const viewportHeight = layout?.viewportHeight ?? 0
  const buffer = Math.max(24, Math.min(64, viewportHeight * .06))
  return Math.max(0, maxScroll - buffer)
}

export function getRibbonSegmentCount(layout) {
  const profile = layout.profile
  const estimate = Math.round(layout.rootHeight / profile.segmentPixels)
  return Math.max(profile.minSegments, Math.min(profile.maxSegments, estimate))
}
