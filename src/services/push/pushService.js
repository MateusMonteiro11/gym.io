import { supabase } from '../../lib/supabase'
import { createPushController } from './pushController.js'
import { notificationBridge } from './notificationBridge.js'
import { registerPushSubscription } from './registerPushSubscription.js'

async function rpc(name, args, signal) {
  let request = supabase.rpc(name, args)
  if (signal) request = request.abortSignal(signal)
  const { data, error } = await request
  if (error) throw new Error('push_backend_failed')
  return data
}

const controller = createPushController({
  browser: typeof window === 'undefined' ? null : window,
  publicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
  api: {
    lookup: (endpoint, signal) =>
      rpc('consultar_push_subscription', { p_endpoint: endpoint }, signal),
    register: (value, signal) => registerPushSubscription(supabase, value, signal),
    remove: (id, signal) => rpc('remover_push_subscription', { p_subscription_id: id }, signal),
  },
})

let notificationUserId
const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
  const userId = session?.user?.id ?? null
  if (event === 'SIGNED_OUT' || (notificationUserId && userId !== notificationUserId)) {
    controller.invalidate()
    void notificationBridge.disable('logout')
  }
  notificationUserId = userId
})
if (import.meta.hot) import.meta.hot.dispose(() => authListener.subscription.unsubscribe())

export const pushService = {
  ...controller,
  enable: async () => {
    const result = await controller.enable()
    if (result.status === 'subscribed') await notificationBridge.enable()
    return result
  },
  disable: async ({ reason } = {}) => {
    await notificationBridge.disable(reason)
    return controller.disable()
  },
}
