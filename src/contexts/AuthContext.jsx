import {
  createContext,
  useEffect,
  useState
} from 'react'

import { supabase } from '../lib/supabase'
import { getRememberMe, subscribeToAuthStorageChanges } from '../utils/sessionStorage'
import { logError } from '../utils/errorMessages'

export const AuthContext =
  createContext()

export function AuthProvider({
  children
}) {

  const [usuario, setUsuario] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [rememberMe, setRememberMeState] =
    useState(false)

  const [sessionRestored, setSessionRestored] =
    useState(false)

  useEffect(() => {

    const syncRememberMePreference = () => {
      setRememberMeState(getRememberMe())
    }

    async function carregarUsuario() {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (session?.user) {
          setUsuario(session.user)
        } else {
          const {
            data: { user }
          } = await supabase.auth.getUser()

          setUsuario(user)
        }
      } catch (error) {
        logError(error, '[AuthContext] Failed to load user')
        setUsuario(null)
      } finally {
        syncRememberMePreference()
        setSessionRestored(true)
        setLoading(false)
      }
    }

    syncRememberMePreference()
    carregarUsuario()

    const {
      data: listener
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUsuario(session?.user ?? null)
        syncRememberMePreference()
      }
    )

    const unsubscribeStorage = subscribeToAuthStorageChanges(() => {
      syncRememberMePreference()
    })

    return () => {
      listener?.subscription?.unsubscribe()
      unsubscribeStorage?.()
    }

  }, [])

  return (

    <AuthContext.Provider
      value={{
        usuario,
        loading,
        rememberMe,
        sessionRestored
      }}
    >

      {children}

    </AuthContext.Provider>
  )
}