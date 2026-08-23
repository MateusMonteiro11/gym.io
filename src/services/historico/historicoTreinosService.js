import { supabase } from '../../lib/supabase'

/* Listar historicos do usuario */

export async function listarHistoricos(

  idUsuario

) {

  const { data, error } = await supabase
    .from('historico_treinos')
    .select(`
      id_historico,
      data_execucao,
      duracao_segundos,
      total_series,
      total_exercicios,
      treinos (
        nome
      ),
      historico_exercicios (repeticoes_feitas)
    `)
    .eq('id_usuario', idUsuario)
    .order(
      'data_execucao',
      { ascending: false }
    )

  if (error) {

    console.error(error)

    throw error
  }

  return (data || []).map((item) => {

    const totalRepeticoes =
      item.historico_exercicios?.reduce(
        (sum, exercicio) =>
          sum + Number(exercicio.repeticoes_feitas || 0),
        0
      ) || 0

    return {
      ...item,

      total_series:
        Number(item.total_series || 0),

      total_exercicios:
        Number(item.total_exercicios || 0),

      total_repeticoes:
        totalRepeticoes,

      duracao_segundos:
        Number(item.duracao_segundos || 0),
    }

  })
}

/* Busca historico completo, incluindo detalhes dos exercícios feitos naquele treino */

export async function buscarHistoricoCompleto(

  idHistorico

) {

  const { data, error } = await supabase
    .from('historico_treinos')
    .select(`

      *,

      treinos (
        nome
      ),

      historico_exercicios (

        *,

        exercicios (
          nome,
          descricao,
          url_imagem,
          url_video
        )

      )

    `)
    .eq(
      'id_historico',
      idHistorico
    )
    .single()

  if (error) {

    console.error(error)

    throw error
  }

  return data
}
