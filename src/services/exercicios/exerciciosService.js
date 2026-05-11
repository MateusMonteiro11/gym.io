import { supabase } from '../../lib/supabase'

export async function listarExercicios() {
  return await supabase
    .from('exercicios')
    .select('*')
}

export async function criarExercicio(payload) {
  console.log('TODO: implementar criação exercício', payload)
}
