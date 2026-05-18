import { ui } from '../../styles/theme'

export default function LoadingState({ message = 'Carregando...' }) {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="text-center">
        <i className={`${ui.loadingSpinner} mb-3 block`} />
        <p className="text-slate-600">{message}</p>
      </div>
    </div>
  )
}
