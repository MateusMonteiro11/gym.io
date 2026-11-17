import { NavLink } from 'react-router-dom'
import { Dumbbell, History, House, Play } from 'lucide-react'
import ProfileAvatar from '../ProfileAvatar'
import { navigationItems } from './navigationItems'

const icons = { '/dashboard': House, '/treinos': Dumbbell, '/treinar': Play, '/historico': History }

export default function MobileBottomNav({ user, profile, loadingProfile, profileOpen, onProfile }) {
  return (
    <nav className="mobile-bottom-nav md:hidden" aria-label="Navegação principal">
      {navigationItems.map(({ to, mobileLabel }) => {
        const Icon = icons[to]
        return (
          <NavLink
            key={to}
            to={to}
            aria-label={mobileLabel}
            title={mobileLabel}
            className={({ isActive }) => `mobile-bottom-nav__item${isActive && !profileOpen ? ' is-active' : ''}`}
          >
            <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
            <span className="mobile-bottom-nav__label" aria-hidden="true">{mobileLabel}</span>
          </NavLink>
        )
      })}
      <button
        type="button"
        className={`mobile-bottom-nav__item${profileOpen ? ' is-active' : ''}`}
        aria-label="Abrir meu perfil"
        aria-haspopup="dialog"
        aria-expanded={profileOpen}
        title="Perfil"
        onClick={onProfile}
      >
        <span aria-hidden="true">
          <ProfileAvatar
            photo={profile?.foto_perfil}
            user={user}
            name={profile?.nome}
            className={`mobile-bottom-nav__avatar h-6 w-6 text-xs${loadingProfile ? ' opacity-60' : ''}`}
          />
        </span>
        <span className="mobile-bottom-nav__label" aria-hidden="true">Perfil</span>
      </button>
    </nav>
  )
}
