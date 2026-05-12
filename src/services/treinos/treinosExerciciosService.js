import { supabase } from '../../lib/supabase'

/*
ADICIONAR EXERCÍCIO NO TREINO
*/

export async function adicionarExercicio({

  id_treino,
  id_exercicio,
  id_secao,

  series,
  repeticoes,
  carga,
  descanso_segundos,
  ordem

}) {

  const { data, error } = await supabase
    .from('treinos_exercicios')
    .insert({

      id_treino,
      id_exercicio,
      id_secao,

      series,
      repeticoes,
      carga,
      descanso_segundos,
      ordem

    })
    .select(`
      *,
      exercicios (*)
    `)
    .single()

  if (error) throw error

  return data
}

/*
EDITAR EXERCÍCIO DO TREINO
*/

export async function editarExercicioTreino(

  idTreinoExercicio,
  dados

) {

  const { data, error } = await supabase
    .from('treinos_exercicios')
    .update(dados)
    .eq(
      'id_treino_exercicio',
      idTreinoExercicio
    )
    .select()
    .single()

  if (error) throw error

  return data
}

/*
REMOVER EXERCÍCIO
*/

export async function removerExercicio(

  idTreinoExercicio

) {

  const { error } = await supabase
    .from('treinos_exercicios')
    .delete()
    .eq(
      'id_treino_exercicio',
      idTreinoExercicio
    )

  if (error) throw error

  return true
}