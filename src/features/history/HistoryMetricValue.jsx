// Presentation only: the caller retains ownership of localization and formatting.
export default function HistoryMetricValue({ value, className = '' }) {
  const formatted = String(value)
  const parts = formatted.split(/([+−-]?\d[\d.,]*)/).filter(Boolean)
  return <span className={`history-metric-value ${className}`}>
    <span className="history-sr-only">{formatted}</span>
    <span className="history-metric-value-parts" aria-hidden="true">
      {parts.map((part, index) => <span key={index} className={/^[+−-]?\d/.test(part) || part === '—' ? 'history-value-number' : 'history-value-unit'}>{part}</span>)}
    </span>
  </span>
}
