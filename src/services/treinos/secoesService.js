import { supabase } from '../../lib/supabase'

/* Cria a seção */

export async function criarSecao({

  id_treino,
  nome,
  descricao,
  ordem

}) {

  const { data, error } = await supabase
    .from('secoes_treino')
    .insert({
      id_treino,
      nome,
      descricao,
      ordem
    })
    .select()
    .single()

  if (error) throw error

  return data
}

/* Edita a seção */

export async function editarSecao(idSecao, dados) {

  const { data, error } = await supabase
    .from('secoes_treino')
    .update(dados)
    .eq('id_secao', idSecao)
    .select()
    .single()

  if (error) throw error

  return data
}

/* Deleta a seção */

export async function deletarSecao(idSecao) {

  const { error } = await supabase
    .from('secoes_treino')
    .delete()
    .eq('id_secao', idSecao)

  if (error) throw error

  return true
}