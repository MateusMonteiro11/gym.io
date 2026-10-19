import { supabase } from '../../lib/supabase'

/**
 * Normaliza uma data recebida do banco para o formato local YYYY-MM-DD.
 * Aceita strings no formato YYYY-MM-DD, ISO timestamp ou timestamp com fuso.
 * @param {string} dateString
 * @returns {string}
 */

function normalizarData(dateString) {
  if (!dateString) return dateString
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Cria um novo agendamento de treino
 * @param {Object} params
 * @param {number} params.idTreino
 * @param {string} params.dataAgendada - "YYYY-MM-DD" Padrao americano
 * @returns {Promise<Object>}
 */

export async function criarAgendamento({
  idTreino,
  dataAgendada,
  horarioLocal = null,
  lembretes = [],
}) {
  const { data, error } = await supabase
    .rpc('agendar_treino_com_lembretes', {
      p_id_treino: idTreino,
      p_data_agendada: dataAgendada,
      p_horario_local: horarioLocal || null,
      p_lembretes: lembretes,
    })
    .retry(false)

  if (error) throw error
  return data || null
}

/**
 * Lista agendamentos do usuário (apenas não concluídos e futuros)
 * @param {string} idUsuario
 * @returns {Promise<Array>}
 */

export async function listarAgendamentosUsuario(idUsuario) {
  const hoje = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD no fuso horário local

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

  const dadosAjustados = (data || []).map(item => ({
    ...item,
    data_agendada: normalizarData(item.data_agendada),
  }))

  return dadosAjustados
}

/**
 * Exclui permanentemente um agendamento
 * @param {number} idAgendamento
 * @returns {Promise<Object>}
 */
export async function excluirAgendamento(idAgendamento) {
  const { data, error } = await supabase
    .from('agendamentos')
    .delete()
    .eq('id_agendamento', idAgendamento)
    .select()
    .single()

  if (error) throw error
  return data || null
}

/**
 * Marca um agendamento como concluído (ao finalizar um treino)
 * @param {string} idUsuario
 * @param {number} idTreino
 * @returns {Promise<Object|null>}
 */
export async function marcarAgendamentoConcluido(idUsuario, idTreino) {
  if (!idUsuario || !idTreino) return null

  const hoje = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD no fuso horário local

  // Busca o agendamento desse treino para hoje
  const { data: agendamentos, error: erroSelect } = await supabase
    .from('agendamentos')
    .select('id_agendamento')
    .eq('id_usuario', idUsuario)
    .eq('id_treino', idTreino)
    .eq('data_agendada', hoje)
    .eq('concluido', false)
    .single()

  if (erroSelect || !agendamentos) {
    // Se não encontrar agendamento para hoje, isso é normal
    return null
  }

  // Marca como concluído
  const { data, error } = await supabase
    .from('agendamentos')
    .update({ concluido: true })
    .eq('id_agendamento', agendamentos.id_agendamento)
    .select()
    .single()

  if (error) {
    console.error('[marcarAgendamentoConcluido] Erro:', error)
    return null
  }

  return data || null
}
