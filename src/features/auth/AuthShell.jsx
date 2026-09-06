import { useEffect } from 'react'
import { MotionConfig, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import AuthHero from './AuthHero'
import AuthCard from './AuthCard'
import LandingHeader from '../publicSite/LandingHeader'
import InstitutionalFooter from '../publicSite/InstitutionalFooter'
import AuthIllustration from './AuthIllustration'
import '../publicSite/publicSite.css'
import './auth.css'

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
            <AuthIllustration reducedMotion={reducedMotion} />
          </div>
        </main>
        <InstitutionalFooter authState={state} />
      </div>
    </MotionConfig>
  )
}
