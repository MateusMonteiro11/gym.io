import {
  createContext,
  useEffect,
  useState
} from 'react'

import { supabase } from '../lib/supabase'

export const AuthContext =
  createContext()

export function AuthProvider({
  children
}) {

  const [usuario, setUsuario] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {

    async function carregarUsuario() {

      const {
        data: { user }
      } = await supabase.auth.getUser()

      setUsuario(user)

      setLoading(false)
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
      listener.subscription.unsubscribe()
    }

  }, [])

  return (

    <AuthContext.Provider
      value={{
        usuario,
        loading
      }}
    >

      {children}

    </AuthContext.Provider>
  )
}