import logoImg from '../../assets/images/logo_blue.png'
import ThemeToggle from '../ui/ThemeToggle'
import { getHeaderScrollState } from './headerScroll'
import { useNavigationScrollVisibility } from './NavigationScrollContext'

export default function MobileHeader({ onHome }) {
  const { hidden } = useNavigationScrollVisibility(getHeaderScrollState, { pauseDuringInteraction: false })

  return (
    <header className={`mobile-app-header md:hidden ${hidden ? 'is-hidden' : ''}`} inert={hidden ? '' : undefined}>
      <button type="button" onClick={onHome} className="mobile-app-header__brand" aria-label="Gym.io — início">
        <img src={logoImg} width="36" height="36" alt="" />
      </button>
      <ThemeToggle compact variant="ghost" className="min-h-11 min-w-11" />
    </header>
  )
}
