export default function LoadingSpinner({ className = '', label = 'Carregando' }) {
  return (
    <span
      className={`loading-ring inline-block animate-spin rounded-full ${className}`}
      role="status"
      aria-label={label}
    />
  )
}
