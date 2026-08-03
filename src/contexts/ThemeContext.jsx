import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'gymio-theme'
const DARK_THEME = 'dark'
const LIGHT_THEME = 'light'

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return LIGHT_THEME
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK_THEME : LIGHT_THEME
}

function getStoredTheme() {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === DARK_THEME || stored === LIGHT_THEME ? stored : null
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle(DARK_THEME, theme === DARK_THEME)
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }) {
  const [isUserPreference, setIsUserPreference] = useState(() => !!getStoredTheme())
  const [theme, setTheme] = useState(() => getStoredTheme() || getSystemTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia || isUserPreference) return undefined

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onThemeChange = (event) => {
      setTheme(event.matches ? DARK_THEME : LIGHT_THEME)
    }

    mediaQuery.addEventListener('change', onThemeChange)
    return () => mediaQuery.removeEventListener('change', onThemeChange)
  }, [isUserPreference])

  const setPreferredTheme = (nextTheme) => {
    if (nextTheme !== DARK_THEME && nextTheme !== LIGHT_THEME) return
    setTheme(nextTheme)
    setIsUserPreference(true)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextTheme)
    }
  }

  const toggleTheme = () => {
    setPreferredTheme(theme === DARK_THEME ? LIGHT_THEME : DARK_THEME)
  }

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === DARK_THEME,
      toggleTheme,
      setTheme: setPreferredTheme,
    }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
