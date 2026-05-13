import { supabase } from '../../lib/supabase'

/**
 * Cria um novo agendamento de treino
 * @param {Object} params
 * @param {string} params.idUsuario
 * @param {number} params.idTreino
 * @param {string} params.dataTreino - "YYYY-MM-DD"
 * @param {string} params.horario - "HH:MM"
 * @param {string} [params.observacoes]
 * @returns {Promise<Object>}
 */
export async function criarAgendamento({
  idUsuario,
  idTreino,
  dataTreino,
  horario,
  observacoes = '',
}) {
  const { data, error } = await supabase
    .from('agendamentos_treino')
    .insert([
      {
        id_usuario: idUsuario,
        id_treino: idTreino,
        data_treino: dataTreino,
        horario,
        observacoes,
        ativo: true,
      },
    ])
    .select()

  if (error) throw error
  return data?.[0] || null
}

/**
 * Lista agendamentos do usuário (apenas futuras/hoje)
 * @param {string} idUsuario
 * @returns {Promise<Array>}
 */
export async function listarAgendamentosUsuario(idUsuario) {
  const hoje = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('agendamentos_treino')
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
            descanso,
            ordem,
            exercicios (
              id_exercicio,
              nome,
              descricao,
              imagem,
              video
            )
          )
        )
      )
    `)
    .eq('id_usuario', idUsuario)
    .eq('ativo', true)
    .gte('data_treino', hoje)
    .order('data_treino', { ascending: true })
    .order('horario', { ascending: true })

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
    .from('agendamentos_treino')
    .update({ ativo: false })
    .eq('id_agendamento', idAgendamento)
    .select()

  if (error) throw error
  return data?.[0] || null
}
