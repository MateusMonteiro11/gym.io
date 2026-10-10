import { createClient } from 'npm:@supabase/supabase-js@2.106.0'
import webpush from 'npm:web-push@3.6.7'
import { createPushAdminClient } from '../_shared/pushAdminClient.js'
import { createWebPushTransport } from '../_shared/pushTransport.js'
import { createWorkoutPushHandler } from '../_shared/workoutPushHandler.js'
import { createWorkoutPushRepository } from '../_shared/workoutPushRepository.js'

Deno.serve(createWorkoutPushHandler({
  workerToken: Deno.env.get('GYMIO_WORKOUT_WORKER_TOKEN') ?? '',
  initialize: () => {
    const { client } = createPushAdminClient({ createClient, env: (name: string) => Deno.env.get(name) })
    return {
      repository: createWorkoutPushRepository(client),
      sendPush: createWebPushTransport({
        generateRequestDetails: webpush.generateRequestDetails.bind(webpush),
        vapid: { publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '', privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '', subject: Deno.env.get('VAPID_SUBJECT') ?? '' },
      }),
    }
  },
}))
