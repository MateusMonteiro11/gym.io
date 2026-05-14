import { supabase } from '../../lib/supabase'

/* Adicionar exercicio ao historico */

export async function adicionarHistoricoExercicio({

  carga_utilizada,

  repeticoes_feitas,

  id_historico,

  id_exercicio

}) {

  const { data, error } = await supabase
    .from('historico_exercicios')
    .insert({

      carga_utilizada,

      repeticoes_feitas,

      id_historico,

      id_exercicio

    })
    .select(`
      *,

      exercicios (*)
    `)
    .single()

  if (error) {

    console.error(error)

    throw error
  }

  return data
}

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

/* Listar exercicios do historico */

export async function listarHistoricoExercicios(

  idHistorico

) {

  const { data, error } = await supabase
    .from('historico_exercicios')
    .select(`

      *,

      exercicios (
        nome,
        descricao,
        url_imagem,
        url_video
      )

    `)
    .eq(
      'id_historico',
      idHistorico
    )

  if (error) {

    console.error(error)

    throw error
  }

  return data
}