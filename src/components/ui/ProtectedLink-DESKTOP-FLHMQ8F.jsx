import { Link } from 'react-router-dom'
import { useTrainingGuard } from '../contexts/TrainingGuardContext'
import { useUi } from '../contexts/UiContext'

export function ProtectedLink({ to, children, className = '', onClick, ...props }) {
  const { hasActiveTraining } = useTrainingGuard()
  const { confirm } = useUi()

  const handleClick = async (e) => {
    if (hasActiveTraining) {
      e.preventDefault()

      const confirmed = await confirm({
        title: 'Treino em andamento',
        message: 'Se você sair agora, todo progresso será perdido e não será possível recuperar. Tem certeza que deseja sair?',
        confirmLabel: 'Sim, sair e perder progresso',
        cancelLabel: 'Continuar treino',
        variant: 'danger',
      })

      if (confirmed) {
        onClick?.(e)
        window.location.href = to
      }
    } else {
      onClick?.(e)
    }
  }

  return (
    <Link to={to} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  )
}
