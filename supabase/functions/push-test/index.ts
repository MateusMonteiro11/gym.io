import { createClient } from 'npm:@supabase/supabase-js@2.106.0'
import { createPushHandler } from '../_shared/pushHandler.js'
import { createPushRepository } from '../_shared/pushRepository.js'
import webpush from 'npm:web-push@3.6.7'
import { createWebPushTransport } from '../_shared/pushTransport.js'
import { createPushAdminClient } from '../_shared/pushAdminClient.js'

const { client: admin } = createPushAdminClient({ createClient, env: (name: string) => Deno.env.get(name) })

// Compatibility proved on CLI-served edge-runtime 1.77.4 / Deno 2.1.4.
const sendPush = createWebPushTransport({
  generateRequestDetails: webpush.generateRequestDetails.bind(webpush),
  vapid: {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: Deno.env.get('VAPID_SUBJECT') ?? '',
  },
})

Deno.serve(createPushHandler({
  authenticate: async (jwt: string) => {
    const { data, error } = await admin.auth.getUser(jwt)
    if (error || !data.user) throw new Error('authentication_required')
    return data.user
  },
  repository: createPushRepository(admin),
  sendPush,
  allowedOrigins: (Deno.env.get('PUSH_ALLOWED_ORIGINS') ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
}))
