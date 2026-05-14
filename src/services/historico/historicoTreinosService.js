import { supabase } from '../../lib/supabase'

/* Criar historico de treino */

export async function criarHistoricoTreino({

  id_usuario,
  id_treino,

  duracao_segundos,
  observacoes = null

}) {

  const { data, error } = await supabase
    .from('historico_treinos')
    .insert({

      data_execucao:
        new Date().toISOString(),

      duracao_segundos,

      observacoes,

      id_usuario,

      id_treino

    })
    .select()
    .single()

  if (error) {

    console.error(error)

    throw error
  }

  return data
}

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

export async function atualizarHistoricoTreinoStats({
  id_historico,
  total_series,
  total_exercicios,
}) {

  const { data, error } = await supabase
    .from('historico_treinos')
    .update({

      total_series:
        Number(total_series || 0),

      total_exercicios:
        Number(total_exercicios || 0),

    })
    .eq(
      'id_historico',
      id_historico
    )
    .select(`
      id_historico,
      total_series,
      total_exercicios,
      duracao_segundos
    `)
    .single()

  if (error) {

    console.error(
      '[atualizarHistoricoTreinoStats] Erro:',
      error
    )

    throw error
  }

  return {

    ...data,

    total_series:
      Number(data?.total_series || 0),

    total_exercicios:
      Number(data?.total_exercicios || 0),

    duracao_segundos:
      Number(data?.duracao_segundos || 0),

  }
}

/*
BUSCAR HISTÓRICO COMPLETO
*/

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