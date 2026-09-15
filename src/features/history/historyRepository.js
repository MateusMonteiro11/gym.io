import { normalizeSession, normalizeSet, RECENT_HISTORY_LIMIT } from './historyModel.js'

const SESSION_SUMMARY_COLUMNS = 'id_historico,id_sessao,data_execucao,duracao_segundos,total_series,total_exercicios,treinos(nome)'

// Paginate the root rows: embedded exercise arrays can otherwise hit the API's row limit.
export async function readAllPages(queryPage, pageSize = 500) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryPage(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

export function createHistoryRepository(client) {
  const columns = 'id_historico_exercicio,id_historico,id_exercicio,id_treino_exercicio,serie,carga_utilizada,repeticoes_feitas,concluido,criado_em,exercicios(nome,id_categoria,categorias_musculares(id_categoria,nome)),historico_treinos!inner(id_usuario,data_execucao)'
  return {
    async sessions(userId, signal) {
      if (!userId) return []
      const rows = await readAllPages((from, to) => client.from('historico_treinos')
        .select(SESSION_SUMMARY_COLUMNS)
        .eq('id_usuario', userId).order('data_execucao', { ascending: false, nullsFirst: false })
        .order('id_historico', { ascending: false }).range(from, to).abortSignal(signal))
      return rows.map(normalizeSession)
    },
    async recentSessions(userId, signal) {
      if (!userId) return []
      const { data, error } = await client.from('historico_treinos')
        .select(SESSION_SUMMARY_COLUMNS)
        .eq('id_usuario', userId)
        .not('data_execucao', 'is', null)
        .order('data_execucao', { ascending: false, nullsFirst: false })
        .order('id_historico', { ascending: false })
        .limit(RECENT_HISTORY_LIMIT)
        .abortSignal(signal)
      if (error) throw error
      return (data || []).map(normalizeSession).filter((session) => session.id && session.date)
    },
    async sets(userId, { start, end, sessionId } = {}, signal) {
      if (!userId) return []
      const rows = await readAllPages((from, to) => {
        let query = client.from('historico_exercicios').select(columns).eq('historico_treinos.id_usuario', userId)
        if (sessionId != null) query = query.eq('id_historico', sessionId)
        if (start) query = query.gte('historico_treinos.data_execucao', start.toISOString())
        if (end) query = query.lt('historico_treinos.data_execucao', end.toISOString())
        return query.order('id_historico_exercicio', { ascending: true }).range(from, to).abortSignal(signal)
      })
      return rows.map(normalizeSet)
    },
  }
}

export function createHistoryCache(limit = 36) {
  const entries = new Map()
  return {
    load(key, loader) {
      if (entries.has(key)) return entries.get(key).promise
      const controller = new AbortController()
      const entry = { controller }
      entry.promise = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError')
        return loader(controller.signal)
      }).catch((error) => {
        if (entries.get(key) === entry) entries.delete(key)
        throw error
      })
      entries.set(key, entry)
      if (entries.size > limit) entries.delete(entries.keys().next().value)
      return entry.promise
    },
    remove(key) { entries.get(key)?.controller.abort(); entries.delete(key) },
    clear() { entries.forEach((entry) => entry.controller.abort()); entries.clear() },
  }
}
