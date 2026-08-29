import { Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext'

export default function ThemeToggle({ className = '', compact = false, variant = 'surface' }) {
  const { isDark, toggleTheme } = useTheme()
  const ghost = variant === 'ghost'
  const sizeClass = compact
    ? ghost ? 'h-10 w-10 p-0' : 'h-11 w-11 p-0'
    : 'min-h-11 px-3 py-2'
  const appearanceClass = ghost
    ? 'border-transparent bg-transparent text-current shadow-none hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]'
    : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium leading-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${appearanceClass} ${sizeClass} ${className}`}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={isDark ? 'sun' : 'moon'}
          initial={{ opacity: 0, rotate: -24, scale: .78 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 24, scale: .78 }}
          transition={{ duration: .16, ease: 'easeOut' }}
          className="inline-flex"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </motion.span>
      </AnimatePresence>
      {!compact && <span>{isDark ? 'Claro' : 'Escuro'}</span>}
    </button>
  )
}
