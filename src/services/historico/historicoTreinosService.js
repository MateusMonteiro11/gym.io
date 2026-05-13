import { supabase } from '../../lib/supabase'

/*
CRIAR HISTÓRICO DE TREINO
*/

export async function criarHistoricoTreino({

  id_usuario,
  id_treino,

  duracao_minutos,
  observacoes = null

}) {

  const { data, error } = await supabase
    .from('historico_treinos')
    .insert({

      data_execucao:
        new Date().toISOString(),

      duracao_minutos,

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

/*
LISTAR HISTÓRICOS DO USUÁRIO
*/

export async function listarHistoricos(

  idUsuario

) {

  const { data, error } = await supabase
    .from('historico_treinos')
    .select(`

      *,

      treinos (
        nome
      )

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

  return data
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