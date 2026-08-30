import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import logoBlueImg from '../../../assets/images/logo_blue.png'
import ThemeToggle from '../../../components/ui/ThemeToggle'
import PublicHashLink from '../../publicSite/PublicHashLink'

export default function LandingHeader() {
  const [compact, setCompact] = useState(false)
  const { scrollY, scrollYProgress } = useScroll()

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const next = latest > 48
    setCompact((current) => current === next ? current : next)
  })

  return (
    <header className={`landing-header${compact ? ' is-compact' : ''}`}>
      <Link to="/" className="landing-brand" aria-label="Gym.io — início">
        <img src={logoBlueImg} alt="" />
        <span>Gym.io</span>
      </Link>
      <nav className="landing-nav" aria-label="Navegação principal">
        <PublicHashLink to="/#flow">Fluxo</PublicHashLink><PublicHashLink to="/#progress">Memória</PublicHashLink><PublicHashLink to="/#capabilities">Produto</PublicHashLink>
      </nav>
      <div className="landing-actions">
        <ThemeToggle compact variant="ghost" />
        <Link to="/login" className="landing-login">Entrar</Link>
        <Link to="/cadastro" className="landing-start">Começar <span aria-hidden>↗</span></Link>
      </div>
      <motion.i className="landing-header-progress" style={{ scaleX: scrollYProgress }} aria-hidden />
    </header>
  )
}
