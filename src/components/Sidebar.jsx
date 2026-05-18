import { Link, useLocation } from 'react-router-dom'
import logoImg from '../assets/images/Logo.png'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/dashboard', icon: 'fa-solid fa-grip', label: 'Painel' },
  { to: '/treinos', icon: 'fa-solid fa-dumbbell', label: 'Treinos' },
  { to: '/treinar', icon: 'fa-solid fa-play', label: 'Treinar' },
  { to: '/historico', icon: 'fa-solid fa-clock-rotate-left', label: 'Histórico' },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { usuario } = useAuth()

  return (
    <aside className="flex w-full shrink-0 flex-col justify-between border-b border-slate-200/80 bg-white p-5 md:w-72 md:border-b-0 md:border-r md:p-6">
      <div>
        <div className="mb-8 flex items-center gap-3">
          <img
            src={logoImg}
            className="h-11 w-11 rounded-xl shadow-sm ring-1 ring-slate-200/80"
            alt="Logo Gym.io"
          />
          <>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Gym.io</h1>
          </>
        </div>

        <nav className="space-y-1">
          {navItems.map(({ to, icon, label }) => {
            const isActive = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`menu-item flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary-muted text-primary'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <i className={`${icon} w-5 text-center`} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="mt-8 border-t border-slate-100 pt-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-muted text-sm font-semibold text-primary">
            {(usuario?.nome || usuario?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {usuario?.nome || 'Usuário'}
            </p>
            <p className="truncate text-xs text-slate-600">{usuario?.email || ''}</p>
          </div>
        </div>
        <Link
          to="/login"
          className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 transition-colors duration-200 hover:text-danger"
        >
          <i className="fa-solid fa-right-from-bracket w-4" />
          Sair
        </Link>
      </div>
    </aside>
  )
}
