import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUi } from '../contexts/UiContext'

export function useNavigationGuard(isActive, onBlock) {
  const navigate = useNavigate()
  const { confirm } = useUi()

  useEffect(() => {
    if (!isActive) return

    let lastPath = window.location.pathname

    const handlePopState = (event) => {
      event.preventDefault()
      handleNavigationAttempt()
    }

    const handleNavigationAttempt = async () => {
      const confirmed = await confirm({
        title: 'Treino em andamento',
        message: 'Se você sair agora, todo progresso será perdido e não será possível recuperar. Tem certeza que deseja sair?',
        confirmLabel: 'Sim, sair e perder progresso',
        cancelLabel: 'Continuar treino',
        variant: 'danger',
      })

      if (confirmed) {
        window.removeEventListener('popstate', handlePopState)
        navigate(-1)
      }
    }

    window.addEventListener('popstate', handlePopState)

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isActive, navigate, confirm])
}
