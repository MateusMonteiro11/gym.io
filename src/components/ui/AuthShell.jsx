import { useEffect } from 'react'
import { MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import AuthHero from '../../features/auth/AuthHero'
import AuthCard from '../../features/auth/AuthCard'
import { authEntrance } from '../../features/auth/authMotion'
import LandingHeader from '../../features/landing/sections/LandingHeader'
import InstitutionalFooter from '../../features/publicSite/InstitutionalFooter'
import introSmall from '../../assets/images/auth-intro-640.webp'
import introLarge from '../../assets/images/auth-intro-1024.webp'
import '../../features/landing/landing.css'
import '../../features/auth/auth.css'

export default function AuthShell() {
  const { pathname, state } = useLocation()
  const mode = pathname === '/cadastro' ? 'signup' : 'login'
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    document.title = 'Gym.io'
  }, [mode])

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing auth-page" id="top">
        <a className="auth-skip" href="#auth-form-title">Ir para o formulário</a>
        <LandingHeader authMode={mode} />
        <main className="auth-main section-shell">
          <AuthHero reducedMotion={reducedMotion} />
          <div className="auth-grid">
            <AuthCard mode={mode} reducedMotion={reducedMotion} />
            <motion.picture className="auth-illustration" {...authEntrance(reducedMotion, 8, 0.12)}>
              <source media="(min-width: 1024px)" srcSet={`${introSmall} 640w, ${introLarge} 1024w`} sizes="(min-width: 1467px) min(695px, 76vh), min(48vw, 76vh, 760px)" />
              <img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                width="1024" height="1024" decoding="async"
                alt="Academia iluminada com pessoas correndo na esteira, pulando corda e se alongando, ilustradas nas cores do Gym.io." />
            </motion.picture>
          </div>
        </main>
        <InstitutionalFooter authState={state} />
      </div>
    </MotionConfig>
  )
}
