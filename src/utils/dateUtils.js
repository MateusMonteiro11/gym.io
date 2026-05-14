export function parseDateTime(value) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'number') {
    return new Date(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  const texto = value.trim()
  if (!texto) return null

  const hasTimezoneOffset = /[+-]\d{2}:?\d{2}$/.test(texto)
  const hasZulu = texto.endsWith('Z')

  if (hasTimezoneOffset || hasZulu) {
    return new Date(texto)
  }

  const normalized = texto.replace(' ', 'T')
  return new Date(`${normalized}Z`)
}

export function formatDatePtBr(value) {
  const data = parseDateTime(value)
  if (!data || Number.isNaN(data.getTime())) return ''

  return data.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTimePtBr(value) {
  const data = parseDateTime(value)
  if (!data || Number.isNaN(data.getTime())) return ''

  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
