import LoadingSpinner from './LoadingSpinner'

export default function LoadingState({ message = 'Carregando...' }) {
  return (
    <div className="flex flex-1 items-center justify-center py-20 text-slate-900 dark:text-slate-50">
      <div className="text-center">
        <LoadingSpinner className="mx-auto mb-3 h-12 w-12" label={message} />
        <p className="text-slate-600 dark:text-slate-300">{message}</p>
      </div>
    </div>
  )
}
