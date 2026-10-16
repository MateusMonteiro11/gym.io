import { bounded, PUSH_OPT_OUT_KEY, PUSH_SCOPE, PUSH_WORKER_URL } from './pushUtils.js'

// Reading an existing subscription is allowed; permission, registration and
// activation remain exclusively in the explicit Push Foundation flow.
export function createWorkoutControlsIssuer({ browser, rpc }) {
  return (projection) => bounded(async (signal) => {
    const maxActions=browser?.Notification?.maxActions
    if(!Number.isInteger(maxActions)||maxActions<=0)return null
    if (!browser?.isSecureContext || browser.Notification?.permission !== 'granted' ||
      browser.localStorage?.getItem(PUSH_OPT_OUT_KEY) === '1') return null
    const registration = await browser.navigator?.serviceWorker?.getRegistration(PUSH_SCOPE)
    if (registration?.active?.scriptURL !== new URL(PUSH_WORKER_URL, browser.location.origin).href) return null
    const subscription = await registration.pushManager?.getSubscription()
    if (!subscription || signal.aborted) return null
    const subscriptionId = await rpc('consultar_push_subscription', { p_endpoint: subscription.endpoint }, signal)
    if (!subscriptionId || signal.aborted) return null
    const result = await rpc('emitir_controles_notificacao_treino', {
      p_session_id: projection.id_sessao, p_subscription_id: subscriptionId, p_expected_revision: projection.revisao,
    }, signal)
    const confirmed = result?.projection
    return ['ok', 'unchanged'].includes(result?.result) && confirmed?.id_sessao === projection.id_sessao &&
      confirmed?.revisao === projection.revisao ? confirmed : null
  }, 10000)
}
