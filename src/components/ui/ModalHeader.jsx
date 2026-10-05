export default function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 app:border-app-line px-6 py-5 dark:border-slate-700">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 app:text-app-ink dark:text-slate-50">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600 app:text-app-secondary dark:text-slate-300">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 app:text-app-secondary transition-colors duration-200 hover:bg-slate-100 app:hover:bg-app-muted hover:text-slate-700 app:hover:text-app-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 app:focus-visible:ring-app-accent dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          <i className="fa-solid fa-xmark text-lg" />
        </button>
      )}
    </div>
  )
}
