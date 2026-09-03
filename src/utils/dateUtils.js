export function getLocalDateInputValue(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function validateScheduleDate(value, today = getLocalDateInputValue()) {
  if (!value) {
    return {
      isValid: false,
      message: 'Escolha uma data para o treino.',
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return {
      isValid: false,
      message: 'Escolha uma data válida.',
    }
  }

  const parsedDate = parseDateTime(value)
  const isRealDate =
    parsedDate &&
    !Number.isNaN(parsedDate.getTime()) &&
    getLocalDateInputValue(parsedDate) === value

  if (!isRealDate) {
    return {
      isValid: false,
      message: 'Escolha uma data válida.',
    }
  }

  if (value < today) {
    return {
      isValid: false,
      message: 'Escolha hoje ou uma data futura.',
    }
  }

  return { isValid: true, message: '' }
}

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

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(texto)
  if (dateOnlyMatch) {
    const [year, month, day] = texto.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const hasTimezoneOffset = /[+-]\d{2}:?\d{2}$/.test(texto)
  const hasZulu = texto.endsWith('Z')

  if (hasTimezoneOffset || hasZulu) {
    return new Date(texto)
  }

  const dateTimeMatch = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?)?$/
  )

  if (dateTimeMatch) {
    const [, year, month, day, hour = '0', minute = '0', secondPart = '0'] = dateTimeMatch
    const [second, millisecond = '0'] = secondPart.split('.')
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millisecond.padEnd(3, '0').slice(0, 3))
    )
  }

  const normalized = texto.replace(' ', 'T')
  return new Date(normalized)
}

export function normalizeDatabaseUtcTimestamp(value) {
  if (typeof value !== 'string') return value

  const timestamp = value.trim()
  if (!timestamp) return timestamp

  const hasTimezoneOffset = /[+-]\d{2}:?\d{2}$/.test(timestamp)
  const hasZulu = timestamp.endsWith('Z')
  if (hasTimezoneOffset || hasZulu) return timestamp

  const isDatabaseTimestamp = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(timestamp)
  if (!isDatabaseTimestamp) return timestamp

  const normalized = `${timestamp.replace(' ', 'T')}Z`
  return Number.isNaN(Date.parse(normalized)) ? timestamp : normalized
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
