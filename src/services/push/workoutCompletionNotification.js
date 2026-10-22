const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function historyId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null
  const id = String(value ?? '')
  return /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n ? id : null
}

export function createWorkoutCompletionNotifier(bridge, lookupHistory) {
  const pending = new Set()
  const logoutEpoch = bridge.captureLogoutEpoch?.()
  const currentAccount = () => !bridge.isCurrentLogoutEpoch || bridge.isCurrentLogoutEpoch(logoutEpoch)
  return {
    complete: async (session) => {
      if (!currentAccount() || session?.status !== 'finalizada' || !UUID.test(session.id_sessao ?? '') ||
          pending.has(session.id_sessao)) return
      pending.add(session.id_sessao)
      try {
        const scope = await bridge.capture()
        if (!scope || !currentAccount()) return
        let history
        try { history = await lookupHistory(session.id_sessao) } catch { /* honest list fallback */ }
        if (!currentAccount()) return
        await bridge.complete({
          version: 1, type: 'workout_session_completed', id_sessao: session.id_sessao,
          id_historico: history?.id_sessao === session.id_sessao ? historyId(history.id_historico) : null,
        }, scope)
      } catch { /* Notifications never affect the confirmed workout. */ }
      finally { pending.delete(session.id_sessao) }
    },
  }
}
