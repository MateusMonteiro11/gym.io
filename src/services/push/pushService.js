import { supabase } from '../../lib/supabase'
import { createPushController } from './pushController.js'

async function rpc(name, args, signal) {
  let request = supabase.rpc(name, args)
  if (signal) request = request.abortSignal(signal)
  const { data, error } = await request
  // Never pass database/provider messages containing endpoints/keys to UI or logs.
  if (error) throw new Error('push_backend_failed')
  return data
}

export const pushService = createPushController({
  browser: typeof window === 'undefined' ? null : window,
  publicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
  api: {
    lookup: (endpoint, signal) => rpc('consultar_push_subscription', { p_endpoint: endpoint }, signal),
    register: (value) => rpc('registrar_push_subscription', { p_endpoint: value.endpoint, p_p256dh: value.p256dh, p_auth: value.auth }),
    remove: (id, signal) => rpc('remover_push_subscription', { p_subscription_id: id }, signal),
    sendTest: async (id) => {
      const { data, error } = await supabase.functions.invoke('push-test', { body: { subscription_id: id } })
      if (error) throw new Error('push_test_failed')
      return data
    },
  },
})
