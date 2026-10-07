const averageDurationNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

// Keep the recorded seconds precise until the average is displayed.
export function formatAverageWorkoutDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return `${averageDurationNumber.format(seconds)}s`

  const tenths = Math.round(seconds / 6)
  // A displayed fraction of ,9 advances to the next whole minute.
  const minutes = (tenths % 10 === 9 ? tenths + 1 : tenths) / 10
  return `${averageDurationNumber.format(minutes)} min`
}
