// Utility functions for managing session persistence preferences
// This only stores the "remember me" preference, not sensitive data
// The actual session tokens are managed securely by Supabase

const REMEMBER_ME_KEY = 'gym_io_remember_me'
const LAST_EMAIL_KEY = 'gym_io_last_email'

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
}

/**
 * Get the remember me preference
 * @returns {boolean} Whether the user should be remembered
 */
export function getRememberMe() {
  return localStorage.getItem(REMEMBER_ME_KEY) === 'true'
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
}
