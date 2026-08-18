import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function ThemeToggle({ className = '', compact = false }) {
  const { isDark, toggleTheme } = useTheme()
  const sizeClass = compact
    ? 'h-11 w-11 p-0'
    : 'min-h-11 px-3 py-2'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium leading-none text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${sizeClass} ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span>{isDark ? 'Claro' : 'Escuro'}</span>}
    </button>
  )
}
