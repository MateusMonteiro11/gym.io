import { supabase } from '../../lib/supabase'

export async function listarExercicios() {

  const { data, error } = await supabase
    .from('exercicios')
    .select('*')
    .order('nome')

  if (error) {
    console.error(error)
    throw error
  }

  return data
}