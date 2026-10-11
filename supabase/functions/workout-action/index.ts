import { createClient } from 'npm:@supabase/supabase-js@2.106.0'
import { createPushAdminClient } from '../_shared/pushAdminClient.js'
import { actionOrigins, createWorkoutActionHandler } from '../_shared/workoutActionHandler.js'
import { createWorkoutActionRepository } from '../_shared/workoutActionRepository.js'

Deno.serve(createWorkoutActionHandler({
  origins: actionOrigins(Deno.env.get('GYMIO_WORKOUT_ACTION_ORIGINS') ?? 'http://localhost:5173'),
  initialize: () => createWorkoutActionRepository(createPushAdminClient({
    createClient, env: (name: string) => Deno.env.get(name),
  }).client),
}))
