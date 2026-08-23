const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function assertLocalSupabaseTarget(value) {
  let target

  try {
    target = new URL(value)
  } catch {
    throw new Error('TEST_SUPABASE_URL deve ser uma URL local válida.')
  }

  if (target.protocol !== 'http:' || !LOCAL_HOSTS.has(target.hostname.toLowerCase())) {
    throw new Error(
      'Teste Data API bloqueado: TEST_SUPABASE_URL deve apontar para localhost ou 127.0.0.1.'
    )
  }

  return target
}
