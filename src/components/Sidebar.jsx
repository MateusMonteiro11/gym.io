import { Link, useLocation } from 'react-router-dom'
import logoImg from '../assets/images/Logo.png'

const navItems = [
  { to: '/dashboard', icon: 'fa-solid fa-grip', label: 'Painel' },
  { to: '/treinos',   icon: 'fa-solid fa-dumbbell', label: 'Treinos' },
  { to: '/treinar',   icon: 'fa-solid fa-play', label: 'Treinar' },
  { to: '/historico', icon: 'fa-solid fa-clock-rotate-left', label: 'Histórico' },
]

export default function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="w-full md:w-72 bg-white p-6 flex flex-col justify-between shadow-sm shrink-0">
      {/* Topo */}
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <img src={logoImg} className="w-12 h-12 rounded-xl" alt="Logo Gym.io" />
          <div>
            <h1 className="text-xl font-semibold">Gym.io</h1>
            <p className="text-sm text-gray-400">Gestor de treinos</p>
          </div>
        </div>

        {/* Menu */}
        <nav className="space-y-3">
          {navItems.map(({ to, icon, label }) => {
            const isActive = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`menu-item flex items-center gap-3 px-3 py-2 rounded-md font-semibold ${
                  isActive
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-400 hover:bg-gray-100 font-normal'
                }`}
              >
                <i className={`${icon} w-5`}></i>
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Usuário */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
          <div>
            <p className="text-sm font-semibold">usuario</p>
            <p className="text-xs text-gray-400">usuario@gmail.com</p>
          </div>
        </div>
        <Link
          to="/login"
          className="text-sm flex items-center gap-2 hover:text-red-500 text-gray-500"
        >
          <i className="fa-solid fa-right-from-bracket"></i>
          Sair
        </Link>
      </div>
    </aside>
  )
}
