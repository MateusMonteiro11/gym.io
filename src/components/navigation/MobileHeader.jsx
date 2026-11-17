import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMotionValueEvent, useScroll } from 'framer-motion'
import logoImg from '../../assets/images/logo_blue.png'
import ThemeToggle from '../ui/ThemeToggle'
import { getHeaderScrollState } from './headerScroll'

export default function MobileHeader({ onHome }) {
  const { pathname } = useLocation()
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const scrollState = useRef({ position: 0, direction: 0, distance: 0, hidden: false })

  useEffect(() => {
    scrollState.current = { position: window.scrollY, direction: 0, distance: 0, hidden: false }
    setHidden(false)
  }, [pathname])

  useMotionValueEvent(scrollY, 'change', (position) => {
    scrollState.current = getHeaderScrollState(
      scrollState.current,
      position,
      document.documentElement.scrollHeight - window.innerHeight,
    )
    setHidden(scrollState.current.hidden)
  })

  return (
    <header className={`mobile-app-header md:hidden ${hidden ? 'is-hidden' : ''}`} inert={hidden ? '' : undefined}>
      <button type="button" onClick={onHome} className="mobile-app-header__brand" aria-label="Gym.io — início">
        <img src={logoImg} width="36" height="36" alt="" />
      </button>
      <ThemeToggle compact variant="ghost" className="min-h-11 min-w-11" />
    </header>
  )
}
