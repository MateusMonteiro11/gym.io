import { supabase } from '../../lib/supabase'
import { createWorkoutHistoryLookup } from './workoutHistoryLookup.js'

export const buscarHistoricoPorSessao = createWorkoutHistoryLookup(supabase)
