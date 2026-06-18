import {
  createContext,
  useEffect,
  useState
} from 'react'

import { supabase } from '../lib/supabase'
import { getRememberMe } from '../utils/sessionStorage'

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

    async function carregarUsuario() {
      try {
        // First, check if there's a stored session
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (session?.user) {
          // Session was restored from localStorage
          setUsuario(session.user)
          const shouldRemember = getRememberMe()
          setRememberMeState(shouldRemember)
        } else {
          // No stored session
          const {
            data: { user }
          } = await supabase.auth.getUser()

          setUsuario(user)
          const shouldRemember = getRememberMe()
          setRememberMeState(shouldRemember)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        setUsuario(null)
      } finally {
        setSessionRestored(true)
        setLoading(false)
      }
    }

    carregarUsuario()

    const {
      data: listener
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {

        setUsuario(
          session?.user ?? null
        )
      }
    )

    return () => {
      listener?.subscription?.unsubscribe()
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