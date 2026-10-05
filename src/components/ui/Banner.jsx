export default function Banner({ icon, title, description, action, variant = 'primary' }) {
  const variants = {
    primary: 'border-primary/20 app:border-app-accent/20 app:bg-none app:bg-app-selection bg-gradient-to-br from-primary-muted via-white to-white dark:border-slate-700/70 dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950',
    neutral: 'border-slate-200 app:border-app-line app:bg-none app:bg-app-muted bg-gradient-to-br from-slate-50 to-white dark:border-slate-700/70 dark:from-slate-900 dark:to-slate-950',
  }

  return (
    <div
      className={`mb-8 flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between ${variants[variant] || variants.primary}`}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white app:bg-app-surface text-xl text-primary app:text-app-accent shadow-sm ring-1 ring-slate-200/80 app:ring-app-line dark:bg-slate-950 dark:ring-slate-700/70">
            <i className={`fa-solid ${icon}`} />
          </span>
        )}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 app:text-app-ink dark:text-slate-50">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-600 app:text-app-secondary dark:text-slate-300">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
