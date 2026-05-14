import { criarHistoricoTreino, atualizarHistoricoTreinoStats } from '../historico/historicoTreinosService'
import { adicionarHistoricoLote } from '../historico/historicoSeriesService'
import { marcarAgendamentoConcluido } from '../agendamentos/agendamentosService'

/**
 * SALVA O TREINO COMPLETO EXECUTADO PELO USUÁRIO
 *
 * @param {Object} params
 * @param {string} params.idUsuario
 * @param {number} params.idTreino
 * @param {number} params.duracaoSegundos
 * @param {Array}  params.logSeries
 * @param {Object} [params.estatisticas]
 */
export async function salvarHistoricoTreino({
  idUsuario,
  idTreino,
  duracaoSegundos,
  logSeries = [],
  estatisticas = null,
}) {
  if (!idUsuario || !idTreino) {
    throw new Error('Dados inválidos para salvar histórico')
  }

  console.log('[salvarHistoricoTreino] Duração recebida:', duracaoSegundos, 'segundos')

  // 1. cria o registro principal do treino
  const historico = await criarHistoricoTreino({
    id_usuario: idUsuario,
    id_treino: idTreino,
    duracao_segundos: duracaoSegundos,
    observacoes: null,
  })

  if (!historico?.id_historico) {
    throw new Error('Falha ao criar histórico de treino')
  }

  console.log('[salvarHistoricoTreino] Histórico criado:', historico.id_historico, 'Duração:', historico.duracao_segundos)

  // 2. se não houver séries, encerra aqui
  if (!logSeries.length) {
    return historico
  }

  // 3. transforma logSeries no formato do banco
  const payload = logSeries.map((item) => ({
    id_historico: historico.id_historico,
    id_exercicio: item.id_exercicio,
    id_treino_exercicio: item.id_treino_exercicio ?? null,

    serie: item.serie,
    carga_utilizada: item.cargaUtilizada ?? 0,
    repeticoes_feitas: item.repeticoesFeitas ?? 0,
  }))

  // 4. salva em lote
  await adicionarHistoricoLote(payload)

  // 5. atualiza os totais no registro principal de histórico
  const totalSeries = payload.length
  const totalExercicios = new Set(payload.map((item) => item.id_exercicio)).size

  console.log('[salvarHistoricoTreino] Atualizando stats:', { totalSeries, totalExercicios, duracaoSegundos })

  await atualizarHistoricoTreinoStats({
    id_historico: historico.id_historico,
    total_series: totalSeries,
    total_exercicios: totalExercicios,
  })

  // 6. marca agendamento como concluído (se existir para hoje)
  try {
    await marcarAgendamentoConcluido(idUsuario, idTreino)
  } catch (err) {
    console.warn('[salvarHistoricoTreino] Aviso ao marcar agendamento:', err)
  }

  return historico
}