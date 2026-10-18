const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ // ID Hashing

function decimal(value, zero = false, max = 9223372036854775807n) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null
  const text = String(value ?? '')
  return /^(0|[1-9][0-9]*)$/.test(text) &&
    text.length <= 19 &&
    BigInt(text) <= max &&
    (zero || text !== '0')
    ? text
    : null
}

const trim = (value, length) =>
  Array.from(
    String(value ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
  )
    .slice(0, length)
    .join('')

const timestamp = (value) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null

function fields(session, items) {
  if (!session || !UUID.test(session.id_sessao ?? '')) return null
  const ids = {
    id_sessao: session.id_sessao,
    revisao: decimal(session.revisao, true),
    id_treino: decimal(session.id_treino),
    id_treino_exercicio: decimal(session.id_treino_exercicio_atual),
    proxima_serie: decimal(session.serie_atual, false, 32767n),
  }
  if (Object.values(ids).some((v) => v === null)) return null
  const item = (Array.isArray(items) ? items : []).find(
    (item) => decimal(item.id_treino_exercicio) === ids.id_treino_exercicio
  )
  let total = decimal(item?.series, false, 32767n)
  if (total && BigInt(total) < BigInt(ids.proxima_serie)) total = null
  const started = timestamp(session.iniciada_em)
  const now = timestamp(session.agora_servidor)
  if (!started || !now || Date.parse(now) < Date.parse(started)) return null
  return {
    ...ids,
    serie_total: total,
    iniciada_em: started,
    agora_servidor: now,
    exercicio: trim(item?.nome, 80) || 'Exercício',
    data: { url: `/treinar/${ids.id_treino}` },
  }
}

function buildWorkoutProjection(session, items = []) {
  if (session?.status !== 'ativa' || !['descanso', 'execucao'].includes(session.fase)) return null
  const value = fields(session, items)
  if (!value) return null
  const rest = session.fase === 'descanso'
  const restStart = rest ? timestamp(session.descanso_iniciado_em) : null
  const deadline = rest ? timestamp(session.descanso_termina_em) : null
  if (rest && (!restStart || !deadline || Date.parse(deadline) < Date.parse(restStart))) return null
  const paused = Boolean(session.pausada_em)
  return {
    ...value,
    version: 2,
    type: 'workout_projection',
    title: paused ? 'Gym.io · Pausado' : rest ? 'Gym.io · Descanso' : 'Gym.io · Treino',
    body: trim(
      `${value.exercicio} · ${rest ? 'Próxima série' : 'Série'} ${value.proxima_serie}${value.serie_total ? '/' + value.serie_total : ''}`,
      160
    ),
    fase: session.fase,
    pausada: paused,
    descanso_iniciado_em: restStart,
    descanso_termina_em: deadline,
  }
}

function buildConfirmedRestSignal(before, after, items = []) {
  if (
    before?.status !== 'ativa' ||
    before.fase !== 'descanso' ||
    before.pausada_em ||
    after?.status !== 'ativa' ||
    after.fase !== 'execucao' ||
    after.pausada_em ||
    before.id_sessao !== after.id_sessao ||
    String(before.id_treino_exercicio_atual) !== String(after.id_treino_exercicio_atual) ||
    String(before.serie_atual) !== String(after.serie_atual)
  )
    return null
  const value = fields(before, items)
  const revision = decimal(after.revisao, true)
  const now = timestamp(after.agora_servidor)
  if (
    !value ||
    !revision ||
    BigInt(revision) <= BigInt(value.revisao) ||
    !now ||
    Date.parse(now) < Date.parse(before.descanso_termina_em) ||
    !timestamp(before.descanso_iniciado_em) ||
    !timestamp(before.descanso_termina_em)
  )
    return null
  return {
    ...value,
    revisao: revision,
    agora_servidor: now,
    version: 2,
    type: 'workout_rest_finished',
    title: 'Gym.io · Descanso concluído',
    body: trim(
      `${value.exercicio} · Série ${value.proxima_serie}${value.serie_total ? '/' + value.serie_total : ''}`,
      160
    ),
    fase: 'descanso',
    pausada: false,
    descanso_iniciado_em: before.descanso_iniciado_em,
    descanso_termina_em: before.descanso_termina_em,
  }
}

function buildWorkoutLifecycle(session, kind, historyId = null) {
  if (
    !['start', 'complete'].includes(kind) ||
    session?.status !== (kind === 'start' ? 'ativa' : 'finalizada') ||
    !UUID.test(session.id_sessao ?? '')
  )
    return null
  const revision = decimal(session.revisao, true)
  const workout = decimal(session.id_treino)
  const started = timestamp(session.iniciada_em)
  const observed = timestamp(session.agora_servidor)
  if (!revision || !workout || !started || !observed || Date.parse(observed) < Date.parse(started))
    return null
  return {
    version: 1,
    type: kind === 'start' ? 'workout_session_started' : 'workout_session_completed',
    id_sessao: session.id_sessao,
    revisao: revision,
    id_treino: workout,
    iniciada_em: started,
    agora_servidor: observed,
    ...(kind === 'complete' ? { id_historico: decimal(historyId) } : {}),
  }
}

export function createWorkoutNotificationAdapter(bridge, issueControls, lookupHistory) {
  let epoch = 0
  let latest = null
  const completing = new Set()
  const safe = (operation) => {
    try {
      return Promise.resolve(operation()).catch(() => {})
    } catch {
    }
  }
  return {
    accept: (previous, confirmed, items, { started = false } = {}) => {
      const version = ++epoch
      latest = confirmed
      try {
        const scope = bridge.capture?.()
        if (confirmed?.status === 'finalizada' && bridge.complete) {
          const completion = buildWorkoutLifecycle(confirmed, 'complete')
          if (!completion || completing.has(confirmed.id_sessao)) return
          completing.add(confirmed.id_sessao)
          return safe(async () => {
            let history
            try {
              history = await lookupHistory?.(confirmed.id_sessao)
            } catch {
            }
            if (latest?.id_sessao !== confirmed.id_sessao || latest.status !== 'finalizada') return
            await bridge.complete(
              buildWorkoutLifecycle(confirmed, 'complete', history?.id_historico),
              scope
            )
          })
        }
        if (
          previous?.id_sessao &&
          (!confirmed || confirmed.status !== 'ativa' || confirmed.id_sessao !== previous.id_sessao)
        )
          safe(() => bridge.close(previous.id_sessao))
        const payload = buildWorkoutProjection(confirmed, items)
        if (payload) {
          return safe(async () => {
            if (started) {
              const start = buildWorkoutLifecycle(confirmed, 'start')
              if (start)
                try {
                  await bridge.start?.(start, scope)
                } catch {
                }
            }
            if (version !== epoch) return
            if (issueControls && payload.fase === 'descanso') {
              let controls
              try {
                controls = await issueControls(payload)
              } catch {
              }
              if (version !== epoch) return
              if (controls?.version === 3) await bridge.controls(controls, scope)
              else await bridge.project(payload, scope)
            } else await bridge.project(payload, scope)
          })
        }
      } catch {
      }
    },
    restFinished: (before, after, items) => {
      try {
        const payload = buildConfirmedRestSignal(before, after, items)
        if (payload) safe(() => bridge.restFinished(payload))
      } catch {}
    },
  }
}
