import { supabase } from '../../lib/supabase'

const revisaoEsperada = value => value == null ? null : Number(value)

function normalizarSessao(data) {
  if (!data) return null

  return {
    ...data,
    id_treino: data.id_treino == null ? null : Number(data.id_treino),
    id_treino_exercicio_atual: data.id_treino_exercicio_atual == null
      ? null
      : Number(data.id_treino_exercicio_atual),
    indice_exercicio_atual: Number(data.indice_exercicio_atual ?? 0),
    serie_atual: Number(data.serie_atual ?? 1),
    descanso_padrao_segundos: Number(data.descanso_padrao_segundos ?? 60),
    segundos_pausados: Number(data.segundos_pausados ?? 0),
    revisao: Number(data.revisao ?? 0),
  }
}

function normalizarSerie(data) {
  return {
    ...data,
    id_sessao_serie: Number(data.id_sessao_serie),
    id_treino: Number(data.id_treino),
    id_treino_exercicio: Number(data.id_treino_exercicio),
    serie: Number(data.serie),
    carga_utilizada: Number(data.carga_utilizada),
    repeticoes_feitas: Number(data.repeticoes_feitas),
  }
}

async function executarRpc(nome, argumentos) {
  const { data, error } = await supabase
    .rpc(nome, argumentos)
    .retry(false)

  if (error) throw error
  if (!data) throw new Error('A sessão não retornou um estado durável.')

  return normalizarSessao(data)
}

async function buscarSessaoAtiva() {
  const { data, error } = await supabase
    .from('treino_sessoes')
    .select('*')
    .eq('status', 'ativa')
    .order('atualizada_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return normalizarSessao(data)
}

async function buscarSessaoPorId(idSessao) {
  if (!idSessao) return null

  const { data, error } = await supabase
    .from('treino_sessoes')
    .select('*')
    .eq('id_sessao', idSessao)
    .maybeSingle()

  if (error) throw error
  return normalizarSessao(data)
}

export async function listarSeriesConcluidas(idSessao) {
  if (!idSessao) return []

  const { data, error } = await supabase
    .from('treino_sessao_series')
    .select(`
      id_sessao_serie,
      id_sessao,
      id_treino,
      id_treino_exercicio,
      serie,
      carga_utilizada,
      repeticoes_feitas,
      concluida_em
    `)
    .eq('id_sessao', idSessao)
    .order('id_sessao_serie', { ascending: true })

  if (error) throw error
  return (data ?? []).map(normalizarSerie)
}

export async function buscarEstadoSessao(idSessao) {
  const sessao = await buscarSessaoPorId(idSessao)
  if (!sessao) return { sessao: null, series: [] }

  return {
    sessao,
    series: await listarSeriesConcluidas(idSessao),
  }
}

export async function buscarEstadoSessaoAtiva() {
  const sessao = await buscarSessaoAtiva()
  if (!sessao) return { sessao: null, series: [] }

  return {
    sessao,
    series: await listarSeriesConcluidas(sessao.id_sessao),
  }
}

export function iniciarTreinoSessao(idTreino, descansoPadraoSegundos) {
  return executarRpc('iniciar_treino_sessao', {
    p_id_treino: Number(idTreino),
    p_descanso_padrao_segundos: Number(descansoPadraoSegundos),
  })
}

export function concluirTreinoSerie(idSessao, revisao, carga, repeticoes) {
  return executarRpc('concluir_treino_serie', {
    p_id_sessao: idSessao,
    p_revisao_esperada: revisaoEsperada(revisao),
    p_carga_utilizada: carga == null ? null : Number(carga),
    p_repeticoes_feitas: repeticoes == null ? null : Number(repeticoes),
  })
}

export function definirPausaTreinoSessao(idSessao, revisao, pausar) {
  return executarRpc('definir_pausa_treino_sessao', {
    p_id_sessao: idSessao,
    p_revisao_esperada: revisaoEsperada(revisao),
    p_pausar: Boolean(pausar),
  })
}

export function encerrarDescansoTreinoSessao(idSessao, revisao, forcar = false) {
  return executarRpc('encerrar_descanso_treino_sessao', {
    p_id_sessao: idSessao,
    p_revisao_esperada: revisaoEsperada(revisao),
    p_forcar: Boolean(forcar),
  })
}

export function ajustarDescansoTreinoSessao(idSessao, revisao, deltaSegundos) {
  return executarRpc('ajustar_descanso_treino_sessao', {
    p_id_sessao: idSessao,
    p_revisao_esperada: revisaoEsperada(revisao),
    p_delta_segundos: Number(deltaSegundos),
  })
}

export function avancarExercicioTreinoSessao(idSessao, revisao) {
  return executarRpc('avancar_exercicio_treino_sessao', {
    p_id_sessao: idSessao,
    p_revisao_esperada: revisaoEsperada(revisao),
  })
}

export function finalizarTreinoSessao(idSessao, revisao) {
  return executarRpc('finalizar_treino_sessao', {
    p_id_sessao: idSessao,
    p_revisao_esperada: revisaoEsperada(revisao),
  })
}

export function cancelarTreinoSessao(idSessao, revisao) {
  return executarRpc('cancelar_treino_sessao', {
    p_id_sessao: idSessao,
    p_revisao_esperada: revisaoEsperada(revisao),
  })
}
