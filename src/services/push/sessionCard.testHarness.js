// Synthetic test harness only; never imported by the application.
import { buildWorkoutProjection, buildConfirmedRestSignal } from './workoutProjection.js'

export const sessionId = '11111111-1111-4111-8111-111111111111'
export const generation = '22222222-2222-4222-8222-222222222222'
export const items = [{ id_treino_exercicio: '2', nome: 'Supino reto', series: 4 },
  { id_treino_exercicio: '3', nome: 'Crucifixo', series: 3 }]
export const baseSession = { id_sessao: sessionId, id_treino: '9007199254740993', id_treino_exercicio_atual: '2', serie_atual: 1,
  revisao: '1', status: 'ativa', fase: 'execucao', pausada_em: null,
  iniciada_em: '2026-10-10T10:00:00Z', agora_servidor: '2026-10-10T10:00:01Z', descanso_iniciado_em: null, descanso_termina_em: null }
export function sessionSequence() {
  const steps = ['start', 'exec', 'rest', 'pause', 'resume', 'add', 'skip', 'next', 'rest', 'pause',
    'resume', 'finish', 'exec', 'next', 'rest', 'add', 'pause', 'resume', 'skip', 'exec']
  let session = { ...baseSession }, clock = Date.parse(session.agora_servidor)
  return steps.map((step, index) => {
    const before = { ...session }; clock += 1000
    if (step === 'finish') clock = Date.parse(before.descanso_termina_em) + 1000
    session = { ...session, revisao: String(index + 1), agora_servidor: new Date(clock).toISOString() }
    if (step === 'rest') Object.assign(session, { fase: 'descanso', serie_atual: session.serie_atual + 1,
      descanso_iniciado_em: session.agora_servidor, descanso_termina_em: new Date(clock + 106000).toISOString() })
    if (step === 'pause') session.pausada_em = session.agora_servidor
    if (step === 'resume') {
      session.descanso_termina_em = new Date(Date.parse(session.descanso_termina_em) + clock - Date.parse(session.pausada_em)).toISOString()
      session.descanso_iniciado_em = new Date(Date.parse(session.descanso_iniciado_em) + clock - Date.parse(session.pausada_em)).toISOString()
      session.pausada_em = null
    }
    if (step === 'add') session.descanso_termina_em = new Date(Date.parse(session.descanso_termina_em) + 15000).toISOString()
    if (['skip', 'finish', 'next'].includes(step)) Object.assign(session, { fase: 'execucao', pausada_em: null, descanso_iniciado_em: null, descanso_termina_em: null })
    if (step === 'next') Object.assign(session, { id_treino_exercicio_atual: '3', serie_atual: 1 })
    return { step, value: step === 'finish' ? buildConfirmedRestSignal(before, session, items) : buildWorkoutProjection(session, items), alert: step === 'finish' }
  })
}
export function controls(value = sessionSequence()[2].value, gen = generation) {
  const eligible = value.pausada ? 'rest_paused' : Date.parse(value.agora_servidor) >= Date.parse(value.descanso_termina_em) ? 'rest_finished' : 'rest_active'
  const names = eligible === 'rest_paused' ? ['rest_resume', 'rest_skip'] : eligible === 'rest_finished' ? ['rest_continue'] : ['rest_add_15', 'rest_skip', 'rest_pause']
  return { ...value, version: 3, type: 'workout_control', generation_id: gen, controls_status: 'emitted', eligible_state: eligible,
    expires_at: new Date(Date.parse(value.agora_servidor) + 900000).toISOString(),
    controls: names.map((action, i) => ({ action, capability: btoa(String.fromCharCode(...Array(32).fill(i + 1))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') })) }
}
export function cardRegistration(coalesce = true) {
  const cards = [], shown = [], events = [], api = { enumerationCount: 0, failEnumerationAt: null, failShow: false, onShow: null }
  const live = () => cards.filter(card => !card.closed)
  const registration = {
    getNotifications: async (options = {}) => {
      api.enumerationCount++
      if (api.enumerationCount === api.failEnumerationAt) throw Error('synthetic_enumeration_failure')
      return live().filter(card => !options.tag || card.tag === options.tag)
    },
    showNotification: async (title, options) => {
      if (api.failShow) throw Error('synthetic_show_failure')
      const before = live().filter(card => card.tag === options.tag)
      shown.push({ title, options: JSON.parse(JSON.stringify(options)), beforeCount: before.length })
      if (coalesce) for (const card of before) { card.closed = true; events.push({ reason: 'native', tag: card.tag }) }
      const card = { tag: options.tag, title, body: options.body, data: JSON.parse(JSON.stringify(options.data)), closed: false,
        close() { if (!this.closed) events.push({ reason: 'explicit', tag: this.tag }); this.closed = true } }
      cards.push(card); api.onShow?.(card)
    },
  }
  return { registration, cards, shown, live, events, api }
}
export function memoryMarkers() {
  const markers = new Map()
  const store = {
    current: async () => markers.get('projection'),
    lifecycle: async (kind, value) => {
      if (markers.get('enabled') === false || markers.get(`closed:${value.id_sessao}`) || markers.get(`${kind}:${value.id_sessao}`)) return { show: false }
      const current = markers.get('projection')
      if (current?.session === value.id_sessao && (BigInt(value.revisao) < BigInt(current.revision) ||
        value.revisao === current.revision && Date.parse(value.agora_servidor) < current.observed)) return { show: false }
      if (current && current.session !== value.id_sessao) {
        if (`${new Date(value.iniciada_em).toISOString()}:${value.id_sessao}` <= `${new Date(current.started).toISOString()}:${current.session}`) return { show: false }
        markers.set(`closed:${current.session}`, true)
      }
      markers.set('projection', { session: value.id_sessao, revision: value.revisao, observed: Date.parse(value.agora_servidor), started: value.iniciada_em, generation: null })
      markers.set(`${kind}:${value.id_sessao}`, true)
      if (kind === 'complete') markers.set(`closed:${value.id_sessao}`, true)
      return { show: true }
    },
    decide: async (value, alert) => {
      const current = markers.get('projection')
      if (markers.get('enabled') === false || markers.get(`closed:${value.id_sessao}`) || markers.get(`generation:${value.generation_id}`)) return { show: false }
      if (current?.session === value.id_sessao && (BigInt(value.revisao) < BigInt(current.revision) ||
        value.revisao === current.revision && Date.parse(value.agora_servidor) < current.observed)) return { show: false }
      if (current && current.session !== value.id_sessao) {
        if (`${value.iniciada_em}:${value.id_sessao}` <= `${current.started}:${current.session}`) return { show: false }
        markers.set(`closed:${current.session}`, true)
      }
      markers.set('projection', { session: value.id_sessao, revision: value.revisao, observed: Date.parse(value.agora_servidor), started: value.iniciada_em, generation: value.generation_id ?? null })
      const key = `receipt:${value.id_sessao}:${value.id_treino_exercicio}:${value.proxima_serie}:rest_finished`
      const fresh = !markers.get(key); if (alert && fresh) markers.set(key, true)
      return { show: true, alert: Boolean(alert && fresh) }
    },
    close: async id => markers.set(`closed:${id}`, true),
    closeGeneration: async id => markers.set(`generation:${id}`, true),
    actionAllowed: async value => {
      const current = markers.get('projection')
      return markers.get('enabled') !== false && !markers.get(`closed:${value.id_sessao}`) && !markers.get(`generation:${value.generation_id}`) &&
        current?.session === value.id_sessao && current.revision === value.revisao && current.generation === value.generation_id
    },
    disable: async () => { markers.set('enabled', false); const current = markers.get('projection'); if (current) markers.set(`closed:${current.session}`, true) },
    enable: async () => markers.set('enabled', true),
  }
  return { store, markers }
}
