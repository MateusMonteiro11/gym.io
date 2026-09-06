import { useRef, useState } from 'react'
import { supabase, setAuthStoragePreference } from '../../lib/supabase'
import { useUi } from '../../contexts/UiContext'
import { getUserFriendlyErrorMessage } from '../../utils/errorMessages'

export default function useGoogleAuth() {
  const [googleLoading, setGoogleLoading] = useState(false)
  const pending = useRef(false)
  const { notify } = useUi()

  async function startGoogleAuth(rememberMe = false) {
    if (pending.current) return
    pending.current = true
    setGoogleLoading(true)
    try {
      setAuthStoragePreference(rememberMe)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      })
      if (error) {
        console.error('Erro ao autenticar com Google:', error.message)
        notify({ title: 'Erro ao entrar', message: error.message, type: 'error' })
        pending.current = false
        setGoogleLoading(false)
      }
    } catch (error) {
      console.error('Erro inesperado no login com Google:', error)
      notify({ title: 'Erro ao entrar', type: 'error',
        message: getUserFriendlyErrorMessage(error, 'Não foi possível entrar com o Google.') })
      pending.current = false
      setGoogleLoading(false)
    }
  }

  return { googleLoading, startGoogleAuth }
}
