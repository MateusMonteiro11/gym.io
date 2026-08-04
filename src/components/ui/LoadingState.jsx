import { ui } from '../../styles/theme'

export default function LoadingState({ message = 'Carregando...' }) {
  return (
    <div className="flex flex-1 items-center justify-center py-20 text-slate-900 dark:text-slate-50">
      <div className="text-center">
        <i className={`${ui.loadingSpinner} mb-3 block`} />
        <p className="text-slate-600 dark:text-slate-300">{message}</p>
      </div>
    </div>
  )
}
