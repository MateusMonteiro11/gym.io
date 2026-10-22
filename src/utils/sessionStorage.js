const REMEMBER_ME_KEY = 'gym_io_remember_me'
const LAST_EMAIL_KEY = 'gym_io_last_email'
const AUTH_STORAGE_EVENT = 'gym_io_auth_storage_changed'

function notifyAuthStorageChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_STORAGE_EVENT))
  }
}

/**
 * Lembrar preferencias
 * @param {boolean} rememberMe - Lembrar-me
 */
export function setRememberMe(rememberMe) {
  if (rememberMe) {
    localStorage.setItem(REMEMBER_ME_KEY, 'true')
  } else {
    localStorage.removeItem(REMEMBER_ME_KEY)
  }

  notifyAuthStorageChange()
}

/**
 * Get
 * @returns {boolean}
 */
export function getRememberMe() {
  return localStorage.getItem(REMEMBER_ME_KEY) === 'true'
}

/**
 * Retorna o storage
 * @returns {Storage}
 */
export function getSessionStorageTarget() {
  try {
    return getRememberMe() ? localStorage : sessionStorage
  } catch {
    return sessionStorage
  }
}

/**
 * Guarda o email ao storage
 * @param {string} email 
 */
export function setLastEmail(email) {
  if (email) {
    localStorage.setItem(LAST_EMAIL_KEY, email)
  }
}

/**
 * Get do ultimo email usado
 * @returns {string|null}
 */
export function getLastEmail() {
  return localStorage.getItem(LAST_EMAIL_KEY)
}

export function clearSessionPreferences() {
  localStorage.removeItem(REMEMBER_ME_KEY)
  localStorage.removeItem(LAST_EMAIL_KEY)
  notifyAuthStorageChange()
}

export function subscribeToAuthStorageChanges(listener) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener(AUTH_STORAGE_EVENT, listener)
  window.addEventListener('storage', listener)

  return () => {
    window.removeEventListener(AUTH_STORAGE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
