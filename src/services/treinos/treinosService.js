import { supabase } from '../../lib/supabase'
import { isWorkoutColor, normalizeWorkoutColor } from '../../utils/workoutColors.js'

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
  id_usuario,
  cor_destaque

}) {

  if (cor_destaque !== undefined && !isWorkoutColor(cor_destaque)) {
    throw new Error('Escolha uma cor válida para o seu treino.')
  }

  const { data, error } = await supabase
    .from('treinos')
    .insert({
      nome,
      descricao,
      publico,
      id_usuario,
      ...(cor_destaque === undefined ? {} : { cor_destaque: normalizeWorkoutColor(cor_destaque) })
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

export async function editarTreino(idTreino, dados, idUsuario) {

  const changingColor = Object.hasOwn(dados, 'cor_destaque')
  if (changingColor && (!idUsuario || !isWorkoutColor(dados.cor_destaque))) {
    throw new Error('Escolha uma cor válida para o seu treino.')
  }

  const update = changingColor ? { ...dados, cor_destaque: normalizeWorkoutColor(dados.cor_destaque) } : dados

  let query = supabase
    .from('treinos')
    .update(update)
    .eq('id_treino', idTreino)

  if (changingColor) query = query.eq('id_usuario', idUsuario).eq('tipo', 'usuario').eq('tipo_treino', 'usuario')

  const { data, error } = await query
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
