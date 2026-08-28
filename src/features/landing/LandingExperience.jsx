import { lazy, Suspense, useRef } from 'react'
import { MotionConfig } from 'framer-motion'
import LandingHeader from './sections/LandingHeader'
import {
  CapabilitiesSection,
  CreatorStory,
  FinalCall,
  HeroSection,
  LandingFooter,
  ProgressionSection,
  TrainingFlowSection,
} from './sections/LandingSections'
import './landing.css'

const MotionSpineScene = lazy(() => import('./three/MotionSpineScene'))

export default function LandingExperience() {
  const landingRef = useRef(null)

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing" id="top" ref={landingRef}>
        <LandingHeader />
        <Suspense fallback={null}><MotionSpineScene rootRef={landingRef} /></Suspense>
        <main className="landing-main">
          <HeroSection />
          <TrainingFlowSection />
          <ProgressionSection />
          <CapabilitiesSection />
          <CreatorStory />
          <FinalCall />
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  )
}
