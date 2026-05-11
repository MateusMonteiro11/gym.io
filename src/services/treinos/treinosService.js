import { supabase } from '../../lib/supabase'

export async function listarTreinos() {
  return await supabase
    .from('treinos')
    .select('*')
}

export async function buscarTreinoPorId(id) {
  return await supabase
    .from('treinos')
    .select('*')
    .eq('id_treino', id)
    .single()
}

export async function criarTreino(payload) {
  console.log('TODO: implementar criação treino', payload)
}

export async function atualizarTreino(id, payload) {
  console.log('TODO: implementar update treino', id, payload)
}

export async function deletarTreino(id) {
  console.log('TODO: implementar delete treino', id)
}
