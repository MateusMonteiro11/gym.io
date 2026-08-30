import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function LandingLoadingState({ message = 'Carregando...' }) {
  return (
    <div
      className="flex h-screen items-center justify-center bg-canvas text-slate-900 dark:text-slate-50"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/80 px-6 py-5 shadow-lg shadow-blue-900/10 ring-1 ring-slate-200/70 backdrop-blur dark:bg-[#080808]/95 dark:shadow-black/50 dark:ring-white/10">
        <LoadingSpinner className="h-12 w-12" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{message}</p>
      </div>
    </div>
  )
}
