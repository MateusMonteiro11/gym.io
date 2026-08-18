const DEFAULT_ERROR_MESSAGE = 'Ocorreu um erro, tente novamente.'

const ERROR_PATTERNS = [
  {
    test: /invalid login credentials|invalid_grant|email or password is invalid/i,
    message: 'Email ou senha inválidos.',
  },
  {
    test: /email not confirmed|confirm your email/i,
    message: 'Confirme seu email antes de continuar.',
  },
  {
    test: /user already registered|already registered|duplicate key|unique constraint/i,
    message: 'Este email já está cadastrado.',
  },
  {
    test: /password.*(weak|too short|requirements)|password.*(must|should)/i,
    message: 'A senha não atende aos requisitos de segurança.',
  },
  {
    test: /rate limit|too many requests|too_many_requests|muitas tentativas|tente novamente em/i,
    message: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  },
  {
    test: /network|fetch failed|failed to fetch|timeout|connection/i,
    message: 'Não foi possível conectar. Verifique sua conexão e tente novamente.',
  },
]

function looksLikeTechnicalError(message) {
  return /authapierror|supabase|postgres|rpc|jwt|fetch failed|network|timeout|request failed|status of \d{3}|unexpected token|typeerror|referenceerror/i.test(message)
}

export function getUserFriendlyErrorMessage(error, fallback = DEFAULT_ERROR_MESSAGE) {
  if (!error) return fallback

  const rawMessage = typeof error?.message === 'string' ? error.message : ''
  const code = typeof error?.code === 'string' ? error.code : ''
  const searchable = `${rawMessage} ${code}`.toLowerCase()

  const matchedPattern = ERROR_PATTERNS.find(({ test }) => test.test(searchable))

  if (matchedPattern) {
    return matchedPattern.message
  }

  if (rawMessage && !looksLikeTechnicalError(searchable)) {
    return rawMessage
  }

  return fallback
}

export function getSchedulingErrorMessage(error) {
  const rawMessage = typeof error?.message === 'string' ? error.message : ''
  const details = typeof error?.details === 'string' ? error.details : ''
  const hint = typeof error?.hint === 'string' ? error.hint : ''
  const code = typeof error?.code === 'string' ? error.code : ''
  const searchable = `${rawMessage} ${details} ${hint} ${code}`.toLowerCase()

  if (
    code === '23514' ||
    /data_agendada.*(check|constraint|anterior|passad)|agendamentos.*check constraint/i.test(searchable)
  ) {
    return 'Escolha hoje ou uma data futura.'
  }

  if (code === '23505' || /agendamentos.*(duplicate key|unique constraint)/i.test(searchable)) {
    return 'Este treino já está agendado para a data selecionada.'
  }

  const knownMessage = getUserFriendlyErrorMessage(error, '')
  if (knownMessage && knownMessage !== rawMessage) {
    return knownMessage
  }

  return 'Não foi possível agendar o treino. Tente novamente.'
}

export function logError(error, context = '') {
  if (!import.meta.env.DEV) {
    return
  }

  if (context) {
    console.error(context, error)
    return
  }

  console.error(error)
}
