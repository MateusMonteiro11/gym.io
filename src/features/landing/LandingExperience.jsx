import { lazy, Suspense, useEffect, useRef } from 'react'
import { MotionConfig, useReducedMotion } from 'framer-motion'
import { useLocation, useNavigationType } from 'react-router-dom'
import LandingHeader from './sections/LandingHeader'
import {
  CapabilitiesSection,
  CreatorStory,
  FaqSection,
  FinalCall,
  HeroSection,
  ProgressionSection,
  TrainingFlowSection,
} from './sections/LandingSections'
import InstitutionalFooter from '../publicSite/InstitutionalFooter'
import { shouldAnimateHashNavigation } from '../publicSite/hashNavigation'
import './landing.css'

const MotionSpineScene = lazy(() => import('./three/MotionSpineScene'))

export default function LandingExperience() {
  const landingRef = useRef(null)
  const location = useLocation()
  const navigationType = useNavigationType()
  const reducedMotion = Boolean(useReducedMotion())
  const { hash, key, state } = location
  const animateHashNavigation = shouldAnimateHashNavigation({
    navigationType,
    state,
    reducedMotion,
  })

  useEffect(() => {
    document.title = 'Gym.io'
  }, [])

  useEffect(() => {
    if (!hash) return

    const targetId = decodeURIComponent(hash.slice(1))
    let cancelled = false

    const scrollToTarget = (behavior = 'instant') => {
      if (cancelled) return
      const target = document.getElementById(targetId)
      if (!target) return

      const scrollMargin = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0
      const targetTop = target.getBoundingClientRect().top + window.scrollY - scrollMargin
      window.scrollTo({ top: Math.max(0, targetTop), behavior })
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToTarget(animateHashNavigation ? 'smooth' : 'instant')
    })
    const timers = animateHashNavigation
      ? []
      : [150, 500, 1100].map((delay) => window.setTimeout(scrollToTarget, delay))

    if (!animateHashNavigation) {
      document.fonts?.ready.then(scrollToTarget)
      window.addEventListener('load', scrollToTarget)
    }

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      timers.forEach((timer) => window.clearTimeout(timer))
      if (!animateHashNavigation) window.removeEventListener('load', scrollToTarget)
    }
  }, [animateHashNavigation, hash, key])

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing" id="top" ref={landingRef}>
        <LandingHeader />
        <Suspense fallback={null}>
          <MotionSpineScene
            rootRef={landingRef}
            skipFragmentRecovery={animateHashNavigation}
          />
        </Suspense>
        <main className="landing-main">
          <HeroSection />
          <TrainingFlowSection />
          <ProgressionSection />
          <CapabilitiesSection />
          <CreatorStory />
          <FaqSection />
          <FinalCall />
        </main>
        <InstitutionalFooter />
      </div>
    </MotionConfig>
  )
}
