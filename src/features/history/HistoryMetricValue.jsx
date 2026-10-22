export default function HistoryMetricValue({ value, className = '', balanceDecimal = false }) {
  const formatted = String(value)
  const parts = formatted.split(/([+−-]?\d[\d.,]*)/).filter(Boolean)
  return <span className={`history-metric-value ${className}`}>
    <span className="history-sr-only">{formatted}</span>
    <span className="history-metric-value-parts" aria-hidden="true">
      {parts.map((part, index) => <span key={index} className={/^[+−-]?\d/.test(part) || part === '—' ? 'history-value-number' : 'history-value-unit'}>
        {balanceDecimal && /^\d+\.\d+$/.test(part)
          ? <>{part.split('.')[0]}<span className="history-value-decimal">.</span>{part.split('.')[1]}</>
          : part}
      </span>)}
    </span>
  </span>
}
