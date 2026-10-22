const averageDurationNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, useGrouping: false })

export const averageDurationNumberLabel = (value) => value == null ? '—' : averageDurationNumber.format(value)

export const compactAverageDurationNumberLabel = (value) => value == null ? '—'
  : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).formatToParts(value)
    .map((part) => part.type === 'decimal' ? '.' : part.value).join('')

export function formatAverageWorkoutDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return `${averageDurationNumber.format(seconds)}s`

  const tenths = Math.round(seconds / 6)
  const minutes = (tenths % 10 === 9 ? tenths + 1 : tenths) / 10
  return `${averageDurationNumber.format(minutes)} min`
}
