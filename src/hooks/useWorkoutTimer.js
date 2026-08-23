export function formatElapsed(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const h = Math.floor(safeSeconds / 3600)
  const m = Math.floor((safeSeconds % 3600) / 60)
  const s = safeSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  return h > 0
    ? `${String(h).padStart(2, '0')}:${mm}:${ss}`
    : `${mm}:${ss}`
}

function calcularTempoTreino(sessao, nowMs = Date.now()) {
  if (!sessao?.iniciada_em) return 0

  const inicioMs = Date.parse(sessao.iniciada_em)
  const fimPersistido = sessao.finalizada_em || sessao.pausada_em
  const fimMs = fimPersistido ? Date.parse(fimPersistido) : Number(nowMs)

  if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs)) return 0

  const bruto = Math.floor((fimMs - inicioMs) / 1000)
  return Math.max(0, bruto - Number(sessao.segundos_pausados || 0))
}

export function useWorkoutTimer({ sessao, nowMs = Date.now() } = {}) {
  const elapsed = calcularTempoTreino(sessao, nowMs)
  const isRunning = Boolean(
    sessao?.status === 'ativa' && !sessao?.pausada_em
  )

  return {
    elapsed,
    isRunning,
    formatted: formatElapsed(elapsed),
  }
}
