export default function ActionLoading({ label = 'Processando…', inverse = false, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <i
        className={`fa-solid fa-spinner animate-spin ${inverse ? 'text-white' : 'text-current'}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  )
}
