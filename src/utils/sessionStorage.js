// Utility functions for managing session persistence preferences
// This only stores the "remember me" preference, not sensitive data
// The actual session tokens are managed securely by Supabase

const REMEMBER_ME_KEY = 'gym_io_remember_me'
const LAST_EMAIL_KEY = 'gym_io_last_email'
const AUTH_STORAGE_EVENT = 'gym_io_auth_storage_changed'

function notifyAuthStorageChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_STORAGE_EVENT))
  }
}

/**
 * Store the remember me preference
 * @param {boolean} rememberMe - Whether to remember the user
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
 * Get the remember me preference
 * @returns {boolean} Whether the user should be remembered
 */
export function getRememberMe() {
  return localStorage.getItem(REMEMBER_ME_KEY) === 'true'
}

/**
 * Get the storage target for auth persistence based on the remember me preference
 * @returns {Storage} The storage implementation to use
 */
export function getSessionStorageTarget() {
  try {
    return getRememberMe() ? localStorage : sessionStorage
  } catch {
    return sessionStorage
  }
}

/**
 * Store the last used email (for UX purposes only)
 * @param {string} email - The email address
 */
export function setLastEmail(email) {
  if (email) {
    localStorage.setItem(LAST_EMAIL_KEY, email)
  }
}

/**
 * Get the last used email
 * @returns {string|null} The last email address or null
 */
export function getLastEmail() {
  return localStorage.getItem(LAST_EMAIL_KEY)
}

/**
 * Clear all session preferences (called on logout)
 */
export function clearSessionPreferences() {
  localStorage.removeItem(REMEMBER_ME_KEY)
  localStorage.removeItem(LAST_EMAIL_KEY)
  notifyAuthStorageChange()
}

/**
 * Subscribe to remember-me and auth storage changes across tabs.
 */
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
