const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function canonicalHistoryId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null
  const text = String(value ?? '')
  return /^[1-9][0-9]*$/.test(text) && text.length <= 19 && BigInt(text) <= 9223372036854775807n
    ? text
    : null
}

export function createWorkoutHistoryLookup(client, timeoutMs = 3000) {
  return async (idSessao) => {
    if (!UUID.test(idSessao ?? '')) return null
    const controller = new AbortController()
    let timer
    try {
      const timedOut = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(Error('history_unavailable'))
        }, timeoutMs)
      })
      const request = client
        .from('historico_treinos')
        .select('id_historico,id_sessao')
        .eq('id_sessao', idSessao)
        .abortSignal(controller.signal)
        .retry(false)
        .maybeSingle()
      const { data, error } = await Promise.race([request, timedOut])
      if (error) throw Error('history_unavailable')
      const id = canonicalHistoryId(data?.id_historico)
      return id && data.id_sessao === idSessao ? { id_historico: id, id_sessao: idSessao } : null
    } finally {
      clearTimeout(timer)
    }
  }
}
