const clamp01 = (value) => Math.max(0, Math.min(1, value))

export const HERO_INTRO_DURATION_MS = 1200

export function shouldRunHeroIntro({
  reducedMotion = false,
  rawScroll = 0,
  hash = '',
  navigationType = 'navigate',
}) {
  return !reducedMotion
    && rawScroll <= 2
    && !hash
    && navigationType !== 'back_forward'
}

export function getHeroIntroReveal({
  elapsedMs = 0,
  initialReveal = 0,
  heroEnd = initialReveal,
  scrollReveal = initialReveal,
  eligible = false,
  durationMs = HERO_INTRO_DURATION_MS,
}) {
  if (!eligible) {
    return { reveal: Math.max(scrollReveal, heroEnd), progress: 1, active: false }
  }

  const progress = clamp01(elapsedMs / Math.max(1, durationMs))
  const easedProgress = 1 - Math.pow(1 - progress, 3)
  const introReveal = initialReveal + (heroEnd - initialReveal) * easedProgress

  return {
    reveal: Math.max(scrollReveal, introReveal),
    progress,
    active: progress < 1 && scrollReveal < heroEnd,
  }
}
