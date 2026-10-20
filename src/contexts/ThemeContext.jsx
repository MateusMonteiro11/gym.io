import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

const ThemeContext = createContext(null)
const serverSnapshot = () => 'light'

export function ThemeProvider({ children }) {
  // Initialized by the blocking head script, before CSS and React paint.
  const controller = window.gymioTheme
  const theme = useSyncExternalStore(controller.subscribe, controller.getSnapshot, serverSnapshot)
  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    toggleTheme: controller.toggleTheme,
    setTheme: controller.setTheme,
  }), [controller, theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
