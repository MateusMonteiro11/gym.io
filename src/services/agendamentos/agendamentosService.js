import { supabase } from '../../lib/supabase'

/**
 * Cria um novo agendamento de treino
 * @param {Object} params
 * @param {string} params.idUsuario
 * @param {number} params.idTreino
 * @param {string} params.dataAgendada - "YYYY-MM-DD"
 * @returns {Promise<Object>}
 */
export async function criarAgendamento({
  idUsuario,
  idTreino,
  dataAgendada,
}) {
  const { data, error } = await supabase
    .from('agendamentos')
    .insert([
      {
        id_usuario: idUsuario,
        id_treino: idTreino,
        data_agendada: dataAgendada,
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data?.[0] || null
}

/**
 * Lista agendamentos do usuário (apenas não concluídos e futuros)
 * @param {string} idUsuario
 * @returns {Promise<Array>}
 */
export async function listarAgendamentosUsuario(idUsuario) {
  const hoje = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      treino:id_treino (
        id_treino,
        nome,
        descricao,
        secoes_treino (
          id_secao,
          nome,
          ordem,
          treinos_exercicios (
            id_treino_exercicio,
            id_exercicio,
            series,
            repeticoes,
            carga,
            descanso_segundos,
            ordem,
            exercicios (
              id_exercicio,
              nome,
              descricao,
              url_imagem,
              url_video
            )
          )
        )
      )
    `)
    .eq('id_usuario', idUsuario)
    .eq('concluido', false)
    .gte('data_agendada', hoje)
    .order('data_agendada', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Cancela um agendamento
 * @param {number} idAgendamento
 * @returns {Promise<Object>}
 */
export async function cancelarAgendamento(idAgendamento) {
  const { data, error } = await supabase
    .from('agendamentos')
    .update({ concluido: true })
    .eq('id_agendamento', idAgendamento)
    .select()

  if (error) throw error
  return data?.[0] || null
}
