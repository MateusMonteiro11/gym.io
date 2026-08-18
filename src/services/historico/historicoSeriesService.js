import { supabase } from '../../lib/supabase'

/* Adicionar multiplos exercicios */

export async function adicionarHistoricoLote(

  exercicios

) {

  const { data, error } = await supabase
    .from('historico_exercicios')
    .insert(exercicios)
    .select()

  if (error) {

    console.error(error)

    throw error
  }

  return data
}
