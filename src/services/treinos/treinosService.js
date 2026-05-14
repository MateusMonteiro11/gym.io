import { supabase } from '../../lib/supabase'

/* Lista treinos de usuarios */

export async function listarTreinos(usuarioId) {

  const { data, error } = await supabase
  .from('treinos')
  .select(`
    *,

    secoes_treino (

      *,

      treinos_exercicios (
        id_treino_exercicio
      )

    )
  `)
  .eq('id_usuario', usuarioId)
  .order('criado_em', { ascending: false })

  if (error) {
    console.error(error)
    throw error
  }

  return data
}

/* Busca o treino completo */

export async function buscarTreinoCompleto(idTreino) {

  const { data, error } = await supabase
    .from('treinos')
    .select(`
      *,
      secoes_treino (
        *,
        treinos_exercicios (
          *,
          exercicios (
            *
          )
        )
      )
    `)
    .eq('id_treino', idTreino)
    .single()

  if (error) {
    console.error(error)
    throw error
  }

  return data
}

/* Cria o treino */

export async function criarTreino({

  nome,
  descricao,
  publico,
  id_usuario

}) {

  const { data, error } = await supabase
    .from('treinos')
    .insert({
      nome,
      descricao,
      publico,
      id_usuario
    })
    .select()
    .single()

  if (error) {
    console.error(error)
    throw error
  }

  return data
}

/* Editar treino */

export async function editarTreino(idTreino, dados) {

  const { data, error } = await supabase
    .from('treinos')
    .update(dados)
    .eq('id_treino', idTreino)
    .select()
    .single()

  if (error) {
    console.error(error)
    throw error
  }

  return data
}

/* Deleta treino */

export async function deletarTreino(idTreino) {

  const { error } = await supabase
    .from('treinos')
    .delete()
    .eq('id_treino', idTreino)

  if (error) {
    console.error(error)
    throw error
  }

  return true
}