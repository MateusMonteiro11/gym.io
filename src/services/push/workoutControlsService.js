import { supabase } from '../../lib/supabase'
import { createWorkoutControlsIssuer } from './workoutControlsClient.js'

export const issueWorkoutControls = createWorkoutControlsIssuer({
  browser: typeof window === 'undefined' ? null : window,
  rpc: async (name, args, signal) => {
    const { data, error } = await supabase.rpc(name, args).abortSignal(signal).retry(false)
    if (error) throw new Error('workout_controls_unavailable')
    return data
  },
})
