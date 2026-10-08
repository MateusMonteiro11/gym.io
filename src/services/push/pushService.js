import { supabase } from '../../lib/supabase'
import { createPushController } from './pushController.js'
import { invokePushTest } from './invokePushTest.js'

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
    register: (value, signal) => rpc('registrar_push_subscription', { p_endpoint: value.endpoint, p_p256dh: value.p256dh, p_auth: value.auth }, signal),
    remove: (id, signal) => rpc('remover_push_subscription', { p_subscription_id: id }, signal),
    sendTest: (id, signal) => invokePushTest((name, options) => supabase.functions.invoke(name, options), id, signal),
  },
})
