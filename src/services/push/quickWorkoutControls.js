import { classificarReconciliacaoMutacao } from '../../hooks/treinoSessaoControllerUtils.js'

export function isPushEntry(search) {
  const values = new URLSearchParams(search).getAll('from')
  return values.length === 1 && values[0] === 'push'
}

// Presentation derived only from the authenticated Player's confirmed state.
export function quickControlState(snapshot) {
  const player = snapshot?.player
  const session = player?.sessao
  if (!snapshot?.fromPush || !snapshot.userId || !snapshot.workoutId ||
    player?.carregandoSessao || player?.sessaoConflitante ||
    session?.status !== 'ativa' || session.fase !== 'descanso' ||
    !session.id_sessao || session.id_treino_exercicio_atual == null || session.serie_atual == null ||
    String(session.id_treino) !== String(snapshot.workoutId) ||
    (session.id_usuario && session.id_usuario !== snapshot.userId) ||
    !Number.isFinite(Date.parse(session.descanso_termina_em)) || !Number.isFinite(player.descansoTimer?.restante)) return null
  return session.pausada_em ? 'paused' : player.descansoTimer.restante <= 0 ? 'finished' : 'active'
}

export const quickActions = {
  active: [['add', '+15s'], ['skip', 'Pular'], ['pause', 'Pausar']],
  paused: [['resume', 'Retomar'], ['skip', 'Pular']],
  finished: [['continue', 'Continuar']],
}
const partialFailure = 'O descanso foi retomado, mas não foi possível pular. Confira o estado atual e tente novamente.'
const operationFailure = 'Não foi possível concluir a ação. Confira o estado atual e tente novamente.'
const sameRest = (before, after) => before && after &&
  before.id_sessao === after.id_sessao &&
  String(before.id_treino_exercicio_atual) === String(after.id_treino_exercicio_atual) &&
  String(before.serie_atual) === String(after.serie_atual)

// This queue orchestrates UI gestures, never owns Session V2 state/revision/time.
export function createQuickWorkoutController(onChange, confirmationTimeout = 10000) {
  let snapshot, busy = false, epoch = 0, active = true
  const waiting = new Set()
  const publish = (feedback = '') => onChange({ busy, feedback })
  const cancel = () => { epoch++; busy = false; for (const wake of [...waiting]) wake(true) }
  const checkResumed = (before) => {
    const session = snapshot?.player?.sessao
    if (!quickControlState(snapshot) || !sameRest(before, session)) return 'stop'
    if (session.pausada_em || snapshot.player.salvando) return 'wait'
    return classificarReconciliacaoMutacao(before, session) === 'revisao_avancou' ? 'ready' : 'wait'
  }
  const confirmedResume = (before, version) => new Promise((resolve) => {
    let timer
    const wake = (cancelled = false) => {
      const result = cancelled || version !== epoch ? 'stop' : checkResumed(before)
      if (result === 'wait') return
      clearTimeout(timer); waiting.delete(wake); resolve(result === 'ready')
    }
    timer = setTimeout(() => wake(true), confirmationTimeout)
    waiting.add(wake); wake()
  })
  return {
    // Called after React commits: callbacks here belong to the confirmed render.
    update(next) {
      if (snapshot && (snapshot.scopeKey !== next.scopeKey || snapshot.userId !== next.userId ||
        snapshot.workoutId !== next.workoutId || snapshot.fromPush !== next.fromPush)) {
        cancel(); publish()
      }
      snapshot = next
      for (const wake of [...waiting]) wake()
    },
    mount() { active = true },
    unmount() { active = false; cancel() },
    async execute(action) {
      const state = quickControlState(snapshot)
      if (!active || busy || snapshot?.player?.salvando || !quickActions[state]?.some(([name]) => name === action)) return false
      const version = epoch, before = snapshot.player.sessao
      busy = true; publish()
      let resumed = false
      try {
        if (state === 'paused' && action === 'skip') {
          if (!await snapshot.player.workoutTimer.toggle()) {
            if (active && version === epoch) publish(operationFailure)
            return false
          }
          if (!await confirmedResume(before, version)) {
            if (active && version === epoch) publish('Não foi possível confirmar a retomada para pular. Confira o estado atual e tente novamente.')
            return false
          }
          resumed = true
        }
        if (!active || version !== epoch || !sameRest(before, snapshot?.player?.sessao)) return false
        const player = snapshot.player
        const handler = action === 'add' ? player.descansoTimer.adicionarTempo
          : action === 'skip' ? player.pularDescanso
          : action === 'continue' ? player.continuarSerie : player.workoutTimer.toggle
        const result = await handler()
        if (!result && active && version === epoch) publish(resumed ? partialFailure : operationFailure)
        return Boolean(result)
      } catch {
        if (active && version === epoch) publish(resumed ? partialFailure : operationFailure)
        return false
      } finally {
        if (active && version === epoch) { busy = false; onChange({ busy }) }
      }
    },
  }
}
