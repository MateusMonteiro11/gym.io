import { supabase } from '../../lib/supabase'
import {
  criarMapaMemoriasHistoricas,
  normalizarIdsExercicios,
} from '../../utils/memoriaExercicioUtils'

export async function buscarMemoriasExercicios(idsExercicios) {
  const ids = normalizarIdsExercicios(idsExercicios)
  if (!ids.length) return new Map()

  const { data, error } = await supabase.rpc('buscar_memorias_exercicios', {
    p_ids_exercicios: ids,
  })

  if (error) throw error
  return criarMapaMemoriasHistoricas(data)
}
