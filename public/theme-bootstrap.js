;(function (browser) {
  if (browser.gymioTheme) return

  const key = 'gymio-theme'
  const root = browser.document.documentElement
  const valid = value => value === 'light' || value === 'dark'
  const listeners = new Set()
  let storage = null
  let media = null
  let preference = null

  try {
    storage = browser.localStorage
    const stored = storage.getItem(key)
    preference = valid(stored) ? stored : null
  } catch { /* Private browser */ }
  try { media = browser.matchMedia('(prefers-color-scheme: dark)') }
  catch { /* Navegador sem cossciencia de tema por padrão vem no tema claro. */ }

  function apply() {
    const theme = preference || (media?.matches ? 'dark' : 'light')
    const changed = root.dataset.theme !== theme
    root.dataset.theme = theme
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    if (changed) listeners.forEach(listener => listener())
  }

  function setTheme(theme) {
    if (!valid(theme)) return
    preference = theme
    try { storage?.setItem(key, theme) }
    catch { /* Manter preferencia */ }
    apply()
  }

  function systemChanged() { if (!preference) apply() }
  if (media?.addEventListener) media.addEventListener('change', systemChanged)
  else media?.addListener?.(systemChanged)

  browser.addEventListener('storage', event => {
    if (event.storageArea && event.storageArea !== storage) return
    if (event.key !== key && event.key !== null) return
    if (event.key === key) preference = valid(event.newValue) ? event.newValue : null
    else {
      try {
        const stored = storage?.getItem(key)
        preference = valid(stored) ? stored : null
      } catch { preference = null }
    }
    apply()
  })

  apply()
  browser.gymioTheme = {
    getSnapshot: () => root.dataset.theme,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setTheme,
    toggleTheme: () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'),
  }
})(window)
