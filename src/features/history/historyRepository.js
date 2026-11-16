import { normalizeSession, normalizeSet, recordedDate, RECENT_HISTORY_LIMIT } from './historyModel.js'
import { HISTORY_LIMITS, HistoryVolumeLimitError } from './historyLimits.js'
import { annualHistoryBounds } from '../../utils/dashboardInsights.js'
import { normalizeDatabaseUtcTimestamp } from '../../utils/dateUtils.js'

const SESSION_SUMMARY_COLUMNS = 'id_historico,id_sessao,data_execucao,duracao_segundos,total_series,total_exercicios,treinos(nome)'

export async function readAllPages(queryPage, pageSize = 500, { maxRows = HISTORY_LIMITS.sets, signal } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || !Number.isInteger(maxRows) || maxRows < 1) throw new RangeError('Invalid history read budget')
  const rows = []
  for (let from = 0; ; ) {
    signal?.throwIfAborted()
    const size = Math.min(pageSize, maxRows - rows.length + 1)
    const { data, error } = await queryPage(from, from + size - 1)
    signal?.throwIfAborted()
    if (error) throw error
    const page = data || []
    if (rows.length + page.length > maxRows) throw new HistoryVolumeLimitError(maxRows)
    for (const row of page) rows.push(row)
    if (page.length < size) return rows
    from += page.length
  }
}

export function createHistoryRepository(client) {
  const columns = 'id_historico_exercicio,id_historico,id_exercicio,id_treino_exercicio,serie,carga_utilizada,repeticoes_feitas,concluido,criado_em,exercicios(nome,id_categoria,categorias_musculares(id_categoria,nome)),historico_treinos!inner(id_usuario,data_execucao)'
  return {
    async firstActivityDate(userId, signal) {
      if (!userId) return null
      const { data, error } = await client.from('historico_treinos')
        .select('data_execucao').eq('id_usuario', userId).gt('total_exercicios', 0)
        .lte('data_execucao', new Date().toISOString())
        .order('data_execucao', { ascending: true, nullsFirst: false })
        .limit(1).maybeSingle().abortSignal(signal)
      if (error) throw error
      return recordedDate(data?.data_execucao)
    },
    async annualActivity(userId, year, signal) {
      if (!userId) return []
      const { start, end } = annualHistoryBounds(year)
      const now = new Date().toISOString()
      const rows = await readAllPages((from, to) => client.from('historico_treinos')
        .select('id_historico,data_execucao,total_exercicios')
        .eq('id_usuario', userId).gte('data_execucao', start.toISOString()).lt('data_execucao', end.toISOString())
        .lte('data_execucao', now)
        .order('data_execucao', { ascending: true }).order('id_historico', { ascending: true })
        .range(from, to).abortSignal(signal), 500, { maxRows: HISTORY_LIMITS.sessions, signal })
      return rows.map((row) => ({ ...row, data_execucao: normalizeDatabaseUtcTimestamp(row.data_execucao) }))
    },
    async sessions(userId, signal, { start, end } = {}) {
      if (!userId) return []
      const rows = await readAllPages((from, to) => {
        let query = client.from('historico_treinos').select(SESSION_SUMMARY_COLUMNS).eq('id_usuario', userId)
        if (start) query = query.gte('data_execucao', start.toISOString())
        if (end) query = query.lt('data_execucao', end.toISOString())
        return query.order('data_execucao', { ascending: false, nullsFirst: false })
          .order('id_historico', { ascending: false }).range(from, to).abortSignal(signal)
      }, 500, { maxRows: HISTORY_LIMITS.sessions, signal })
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
      }, 500, { maxRows: sessionId != null ? HISTORY_LIMITS.sessionSets : HISTORY_LIMITS.sets, signal })
      return rows.map(normalizeSet)
    },
  }
}

export function createHistoryCache(limit = HISTORY_LIMITS.cacheEntries) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Invalid history cache budget')
  const entries = new Map()
  return {
    load(key, loader) {
      if (entries.has(key)) return entries.get(key).promise
      const controller = new AbortController()
      const entry = { controller, pending: true }
      entry.promise = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError')
        return loader(controller.signal)
      }).then((data) => { entry.pending = false; return data }).catch((error) => {
        if (entries.get(key) === entry) entries.delete(key)
        throw error
      })
      entries.set(key, entry)
      if (entries.size > limit) {
        const oldest = entries.keys().next().value
        entries.get(oldest).controller.abort()
        entries.delete(oldest)
      }
      return entry.promise
    },
    remove(key) { entries.get(key)?.controller.abort(); entries.delete(key) },
    cancelPending(key) { if (entries.get(key)?.pending) this.remove(key) },
    clear() { entries.forEach((entry) => entry.controller.abort()); entries.clear() },
  }
}
