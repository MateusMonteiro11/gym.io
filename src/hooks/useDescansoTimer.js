import { formatElapsed } from './useWorkoutTimer.js'

export function calcularDescanso(sessao, nowMs = Date.now()) {
  const emDescanso = sessao?.status === 'ativa' && sessao?.fase === 'descanso'
  const inicioMs = sessao?.descanso_iniciado_em
    ? Date.parse(sessao.descanso_iniciado_em)
    : Number.NaN
  const fimMs = sessao?.descanso_termina_em
    ? Date.parse(sessao.descanso_termina_em)
    : Number.NaN

  if (!emDescanso || !Number.isFinite(fimMs)) {
    return { ativo: false, restante: 0, total: 0, percentual: 0 }
  }

  const pausaMs = sessao?.pausada_em
    ? Date.parse(sessao.pausada_em)
    : Number.NaN
  const referenciaMs = Number.isFinite(pausaMs) ? pausaMs : Number(nowMs)
  const restante = Math.max(0, Math.ceil((fimMs - referenciaMs) / 1000))
  const total = Number.isFinite(inicioMs)
    ? Math.max(0, Math.round((fimMs - inicioMs) / 1000))
    : Number(sessao.descanso_padrao_segundos || 0)
  const percentual = total > 0
    ? Math.min(100, Math.max(0, Math.round((restante / total) * 100)))
    : 0

  return {
    ativo: restante > 0,
    restante,
    total,
    percentual,
  }
}

export function useDescansoTimer({ sessao, nowMs = Date.now() } = {}) {
  const descanso = calcularDescanso(sessao, nowMs)

  return {
    ...descanso,
    formatted: formatElapsed(descanso.restante),
  }
}
