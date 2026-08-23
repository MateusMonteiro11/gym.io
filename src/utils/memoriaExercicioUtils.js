function numeroFinitoOu(valor, fallback = 0) {
  if (valor == null || valor === '') return fallback

  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : fallback
}

function instanteDaSerie(serie) {
  const timestamp = Date.parse(serie?.concluida_em ?? '')
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

export function normalizarIdsExercicios(idsExercicios = []) {
  return [...new Set(
    idsExercicios
      .map((id) => Number(id))
      .filter((id) => Number.isSafeInteger(id) && id > 0)
  )]
}

export function criarMapaMemoriasHistoricas(rows = []) {
  const memorias = new Map()

  for (const row of rows ?? []) {
    const idExercicio = Number(row?.id_exercicio)
    if (!Number.isSafeInteger(idExercicio) || idExercicio <= 0) continue

    memorias.set(idExercicio, {
      carga: numeroFinitoOu(row.carga_utilizada),
      repeticoes: numeroFinitoOu(row.repeticoes_feitas),
      concluidaEm: row.criado_em ?? null,
      idHistoricoExercicio: row.id_historico_exercicio == null
        ? null
        : Number(row.id_historico_exercicio),
      idHistorico: row.id_historico == null ? null : Number(row.id_historico),
      idSessao: row.id_sessao ?? null,
    })
  }

  return memorias
}

function obterUltimaSerieConfirmada(
  seriesConcluidas,
  idTreinoExercicio
) {
  const idPlacement = Number(idTreinoExercicio)
  if (!Number.isSafeInteger(idPlacement) || idPlacement <= 0) return null

  return (seriesConcluidas ?? []).reduce((ultima, serie) => {
    if (Number(serie?.id_treino_exercicio) !== idPlacement) return ultima
    if (!ultima) return serie

    const diferencaTimestamp = instanteDaSerie(serie) - instanteDaSerie(ultima)
    if (diferencaTimestamp !== 0) return diferencaTimestamp > 0 ? serie : ultima

    return Number(serie?.id_sessao_serie ?? -1) >
      Number(ultima?.id_sessao_serie ?? -1)
      ? serie
      : ultima
  }, null)
}

export function resolverValoresIniciaisExercicio({
  exercicio,
  seriesConcluidas = [],
  memoriaHistorica = null,
  idTreinoExercicioAtual = null,
} = {}) {
  const idPlacement = Number(exercicio?.id_treino_exercicio)
  const idPlacementSessao = idTreinoExercicioAtual == null
    ? idPlacement
    : Number(idTreinoExercicioAtual)
  const placementConfere = idPlacement === idPlacementSessao
  const ultimaSerie = placementConfere
    ? obterUltimaSerieConfirmada(seriesConcluidas, idPlacement)
    : null

  if (ultimaSerie) {
    return {
      carga: numeroFinitoOu(ultimaSerie.carga_utilizada),
      repeticoes: numeroFinitoOu(ultimaSerie.repeticoes_feitas),
      origem: 'sessao',
    }
  }

  if (memoriaHistorica) {
    return {
      carga: numeroFinitoOu(memoriaHistorica.carga),
      repeticoes: numeroFinitoOu(memoriaHistorica.repeticoes),
      origem: 'historico',
    }
  }

  if (exercicio) {
    return {
      carga: numeroFinitoOu(exercicio.carga),
      repeticoes: numeroFinitoOu(exercicio.repeticoes),
      origem: 'prescricao',
    }
  }

  return { carga: 0, repeticoes: 0, origem: 'fallback' }
}

export async function carregarMemoriasComFallback(
  idsExercicios,
  buscarMemorias,
  onError = () => {}
) {
  try {
    return await buscarMemorias(idsExercicios)
  } catch (error) {
    onError(error)
    return new Map()
  }
}
