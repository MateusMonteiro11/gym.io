// Only this fixed contract crosses from the sender into UI state/messages.
export const PUSH_TEST_RESULTS = Object.freeze({
  sent: { status: 200, message: 'O serviço de Push aceitou o envio. Confira a notificação no dispositivo.' },
  expired: { status: 200, message: 'O vínculo expirou. Ative novamente neste navegador.' },
  subscription_changed: { status: 200, message: 'O vínculo foi alterado. Ative novamente neste navegador.' },
  rate_limited: { status: 429, message: 'Aguarde alguns segundos antes de enviar outro teste.' },
  temporarily_unavailable: { status: 503, message: 'O serviço de Push está temporariamente indisponível.' },
  provider_not_supported: { status: 422, message: 'O serviço de Push deste navegador não é suportado pela configuração atual.' },
  subscription_not_found: { status: 404, message: 'O vínculo não foi encontrado. Ative novamente neste navegador.' },
  invalid_request: { status: 400, message: 'Não foi possível solicitar o teste. Tente ativar novamente.' },
  authentication_required: { status: 401, message: 'Sua sessão não pôde ser validada. Entre novamente na conta.' },
  origin_not_allowed: { status: 403, message: 'O envio de teste não está disponível neste ambiente.' },
  method_not_allowed: { status: 405, message: 'Não foi possível solicitar o teste neste ambiente.' },
})

export function sanitizePushTestResult(value, status) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, 'result') || typeof value.result !== 'string' || !Object.hasOwn(PUSH_TEST_RESULTS, value.result) ||
    PUSH_TEST_RESULTS[value.result].status !== status) throw new Error('push_test_failed')
  return { result: value.result }
}

export function pushTestMessage(result) {
  return typeof result === 'string' && Object.hasOwn(PUSH_TEST_RESULTS, result) ? PUSH_TEST_RESULTS[result].message : 'Não foi possível concluir o envio de teste.'
}

// Shared with the hook so its finally path and account-generation guard are tested.
export async function runPushOperation({ action, setState, isCurrent }) {
  setState((value) => ({ ...value, busy: true, error: null }))
  try {
    const result = await action()
    if (isCurrent()) setState((value) => ({ ...value, ...result,
      ...(['expired', 'subscription_changed', 'subscription_not_found'].includes(result?.result)
        ? { status: 'unsubscribed', subscriptionId: null } : {}),
    }))
    return result
  } catch (error) {
    if (isCurrent()) setState((value) => ({ ...value, status: 'error',
      error: error?.message === 'push_not_configured' ? 'push_not_configured' : 'push_operation_failed',
    }))
    return null
  } finally {
    if (isCurrent()) setState((value) => ({ ...value, busy: false }))
  }
}
