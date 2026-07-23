import { createClient } from '@supabase/supabase-js'
import { getSessionStorageTarget, setRememberMe } from '../utils/sessionStorage'

const STORAGE_KEY_PREFIXES = ['sb:token', 'supabase.auth.']

export function setAuthStoragePreference(value) {
  setRememberMe(value)
}

export function resetAuthStoragePreference() {
  setRememberMe(false)
}

function getStorage() {
  try {
    return getSessionStorageTarget()
  } catch {
    return sessionStorage
  }
}

function getAlternativeStorage(storage) {
  return storage === localStorage ? sessionStorage : localStorage
}

function removeSupabaseKeys(storage) {
  try {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i)
      if (key && STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key)
      }
    }
  } catch {
    // Ignore storage access issues
  }
}

const supabaseStorage = {
  getItem(key) {
    try {
      return getStorage().getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      const storage = getStorage()
      storage.setItem(key, value)
      removeSupabaseKeys(getAlternativeStorage(storage))
    } catch {
      // Ignore storage access issues
    }
  },
  removeItem(key) {
    try {
      getStorage().removeItem(key)
    } catch {
      // Ignore storage access issues
    }
  },
  clear() {
    removeSupabaseKeys(localStorage)
    removeSupabaseKeys(sessionStorage)
  },
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: supabaseStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)