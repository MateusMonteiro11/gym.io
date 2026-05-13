// ─────────────────────────────────────────────
// treinoUtils.js
// Utilitários para o sistema de treino ativo
// ─────────────────────────────────────────────

/**
 * @typedef {Object} ExercicioFlat
 * @property {number}      id_treino_exercicio
 * @property {number}      id_exercicio
 * @property {string}      nome
 * @property {string}      descricao
 * @property {string|null} imagem
 * @property {string|null} video
 * @property {string}      secao           - Nome da seção
 * @property {number}      id_secao
 * @property {number}      ordemSecao      - Ordem da seção dentro do treino
 * @property {number}      series
 * @property {number}      repeticoes
 * @property {number}      carga
 * @property {number}      descanso        - Em segundos
 * @property {number}      ordem           - Ordem dentro da seção
 * @property {number}      ordemGlobal     - Posição real na lista final
 */

// ─── Flatten ────────────────────────────────

/**
 * Transforma a estrutura aninhada do treino (secoes → exercicios)
 * em uma lista plana e ordenada, pronta para ser executada.
 *
 * Ordem de ordenação:
 *  1. `secoes_treino.ordem`  (ordem da seção)
 *  2. `treinos_exercicios.ordem` (ordem dentro da seção)
 *
 * @param {Object} treino - Objeto completo do treino vindo do Supabase
 * @returns {ExercicioFlat[]}
 */
export function flattenTreino(treino) {
  if (!treino?.secoes_treino?.length) return []

  const exercicios = []

  const secoesOrdenadas = [...treino.secoes_treino].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
  )

  secoesOrdenadas.forEach((secao) => {
    if (!secao.treinos_exercicios?.length) return

    const itensOrdenados = [...secao.treinos_exercicios].sort(
      (a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0)
    )

    itensOrdenados.forEach((item) => {
      exercicios.push({
        id_treino_exercicio : item.id_treino_exercicio,
        id_exercicio        : item.id_exercicio,
        nome                : item.exercicios?.nome?.trim()      || 'Exercício',
        descricao           : item.exercicios?.descricao?.trim() || '',
        imagem              : item.exercicios?.url_imagem        || null,
        video               : item.exercicios?.url_video         || null,
        secao               : secao.nome,
        descricaoSecao      : secao.descricao || '',
        id_secao            : secao.id_secao,
        ordemSecao          : secao.ordem ?? 0,
        series              : item.series             ?? 1,
        repeticoes          : item.repeticoes         ?? 0,
        carga               : item.carga              ?? 0,
        descanso            : item.descanso_segundos  ?? 60,
        ordem               : Number(item.ordem)      || 0,
      })
    })
  })

  // Injeta a posição global após a ordenação definitiva
  return exercicios.map((ex, i) => ({ ...ex, ordemGlobal: i }))
}

// Navegação

/**
 * Retorna o exercício no índice informado, ou `null` se fora dos limites.
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index
 * @returns {ExercicioFlat|null}
 */
export function obterExercicioAtual(exercicios, index) {
  if (!Array.isArray(exercicios) || index < 0 || index >= exercicios.length) {
    return null
  }
  return exercicios[index]
}

/**
 * Retorna os próximos `quantidade` exercícios após o índice atual.
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index
 * @param {number} [quantidade=3]
 * @returns {ExercicioFlat[]}
 */
export function obterProximosExercicios(exercicios, index, quantidade = 3) {
  if (!Array.isArray(exercicios)) return []
  return exercicios.slice(index + 1, index + 1 + quantidade)
}

/**
 * Verifica se o treino está finalizado (index ultrapassou o último exercício).
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index
 * @returns {boolean}
 */
export function treinoFinalizado(exercicios, index) {
  if (!Array.isArray(exercicios) || exercicios.length === 0) return true
  return index >= exercicios.length
}

// ─── Progresso ──────────────────────────────

/**
 * Progresso percentual do treino (0–100).
 * Considera o exercício atual como "em andamento", não concluído.
 *
 * @param {number} index  - Índice do exercício atual (0-based)
 * @param {number} total  - Total de exercícios
 * @returns {number} Valor inteiro entre 0 e 100
 */
export function calcularProgresso(index, total) {
  if (!total || total <= 0) return 0
  if (index < 0)           return 0
  if (index >= total)      return 100
  return Math.round((index / total) * 100)
}

/**
 * Quantidade de exercícios restantes APÓS o atual.
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index
 * @returns {number}
 */
export function calcularExerciciosRestantes(exercicios, index) {
  if (!Array.isArray(exercicios)) return 0
  return Math.max(exercicios.length - (index + 1), 0)
}

/**
 * Soma de séries restantes a partir do exercício atual (inclusive).
 * Útil para mostrar "X séries restantes no treino".
 *
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index
 * @returns {number}
 */
export function calcularSeriesRestantes(exercicios, index) {
  if (!Array.isArray(exercicios) || index >= exercicios.length) return 0
  return exercicios
    .slice(index)
    .reduce((total, ex) => total + (ex.series ?? 0), 0)
}

/**
 * Soma de séries restantes APÓS o exercício atual.
 * Útil para mostrar progresso de série (ex.: "faltam X séries").
 *
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index
 * @param {number} serieAtual - Série atual dentro do exercício (1-based)
 * @returns {number}
 */
export function calcularSeriesRestantesDetalhado(exercicios, index, serieAtual = 1) {
  if (!Array.isArray(exercicios) || index >= exercicios.length) return 0

  const exercicioAtual = exercicios[index]
  const seriesDoAtual  = Math.max((exercicioAtual?.series ?? 1) - serieAtual, 0)

  const seriesProximos = exercicios
    .slice(index + 1)
    .reduce((total, ex) => total + (ex.series ?? 0), 0)

  return seriesDoAtual + seriesProximos
}

// ─── Seções ─────────────────────────────────

/**
 * Retorna o primeiro exercício que pertence a uma seção diferente da atual,
 * ou `null` se não houver próxima seção.
 *
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index
 * @returns {ExercicioFlat|null}
 */
export function obterProximaSecao(exercicios, index) {
  if (!Array.isArray(exercicios)) return null
  const atual = exercicios[index]
  if (!atual) return null

  return exercicios.find(
    (item, i) => i > index && item.id_secao !== atual.id_secao
  ) ?? null
}

/**
 * Retorna todas as seções únicas presentes na lista de exercícios,
 * na ordem em que aparecem.
 *
 * @param {ExercicioFlat[]} exercicios
 * @returns {{ id_secao: number, nome: string, descricao: string, ordemSecao: number }[]}
 */
export function obterSecoes(exercicios) {
  if (!Array.isArray(exercicios)) return []

  const visto = new Set()
  return exercicios
    .filter(({ id_secao }) => {
      if (visto.has(id_secao)) return false
      visto.add(id_secao)
      return true
    })
    .map(({ id_secao, secao, descricaoSecao, ordemSecao }) => ({
      id_secao,
      nome       : secao,
      descricao  : descricaoSecao,
      ordemSecao,
    }))
}

/**
 * Retorna os exercícios de uma seção específica.
 * @param {ExercicioFlat[]} exercicios
 * @param {number} id_secao
 * @returns {ExercicioFlat[]}
 */
export function obterExerciciosDaSecao(exercicios, id_secao) {
  if (!Array.isArray(exercicios)) return []
  return exercicios.filter((ex) => ex.id_secao === id_secao)
}

/**
 * Retorna o índice do primeiro exercício de uma seção.
 * Útil para "pular para a seção X".
 *
 * @param {ExercicioFlat[]} exercicios
 * @param {number} id_secao
 * @returns {number} -1 se não encontrado
 */
export function obterIndiceInicioSecao(exercicios, id_secao) {
  if (!Array.isArray(exercicios)) return -1
  return exercicios.findIndex((ex) => ex.id_secao === id_secao)
}

// ─── Sumário / Estatísticas ─────────────────

/**
 * Retorna um sumário geral do treino antes de iniciá-lo.
 *
 * @param {ExercicioFlat[]} exercicios
 * @returns {{
 *   totalExercicios : number,
 *   totalSeries     : number,
 *   totalSecoes     : number,
 *   tempoEstimadoMin: number,
 *   secoes          : { id_secao: number, nome: string, qtdExercicios: number, qtdSeries: number }[]
 * }}
 */
export function calcularSumarioTreino(exercicios) {
  if (!Array.isArray(exercicios) || exercicios.length === 0) {
    return {
      totalExercicios  : 0,
      totalSeries      : 0,
      totalSecoes      : 0,
      tempoEstimadoMin : 0,
      secoes           : [],
    }
  }

  const totalSeries = exercicios.reduce((acc, ex) => acc + (ex.series ?? 0), 0)

  // Estimativa: (séries × 45s de execução) + (séries × descanso médio) → em minutos
  const tempoExecucaoSeg  = totalSeries * 45
  const tempoDescansoSeg  = exercicios.reduce(
    (acc, ex) => acc + (ex.series ?? 0) * (ex.descanso ?? 60),
    0
  )
  const tempoEstimadoMin  = Math.ceil((tempoExecucaoSeg + tempoDescansoSeg) / 60)

  const secoesMap = new Map()
  exercicios.forEach((ex) => {
    const entrada = secoesMap.get(ex.id_secao) ?? {
      id_secao      : ex.id_secao,
      nome          : ex.secao,
      qtdExercicios : 0,
      qtdSeries     : 0,
    }
    entrada.qtdExercicios += 1
    entrada.qtdSeries     += ex.series ?? 0
    secoesMap.set(ex.id_secao, entrada)
  })

  return {
    totalExercicios  : exercicios.length,
    totalSeries,
    totalSecoes      : secoesMap.size,
    tempoEstimadoMin,
    secoes           : [...secoesMap.values()],
  }
}

/**
 * Retorna estatísticas de progresso no meio do treino.
 *
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index        - Índice atual
 * @param {number} serieAtual   - Série atual dentro do exercício (1-based)
 * @returns {{
 *   percentual           : number,
 *   exerciciosFeitos     : number,
 *   exerciciosRestantes  : number,
 *   seriesRestantes      : number,
 *   totalExercicios      : number,
 *   totalSeries          : number,
 *   secaoAtual           : string|null,
 *   proximaSecao         : string|null,
 *   finalizado           : boolean,
 * }}
 */
export function calcularEstadoTreino(exercicios, index, serieAtual = 1) {
  if (!Array.isArray(exercicios)) {
    return {
      percentual          : 0,
      exerciciosFeitos    : 0,
      exerciciosRestantes : 0,
      seriesRestantes     : 0,
      totalExercicios     : 0,
      totalSeries         : 0,
      secaoAtual          : null,
      proximaSecao        : null,
      finalizado          : true,
    }
  }

  const atual       = obterExercicioAtual(exercicios, index)
  const proxSecao   = obterProximaSecao(exercicios, index)
  const finalizado  = treinoFinalizado(exercicios, index)

  return {
    percentual          : calcularProgresso(index, exercicios.length),
    exerciciosFeitos    : Math.min(index, exercicios.length),
    exerciciosRestantes : calcularExerciciosRestantes(exercicios, index),
    seriesRestantes     : calcularSeriesRestantesDetalhado(exercicios, index, serieAtual),
    totalExercicios     : exercicios.length,
    totalSeries         : exercicios.reduce((acc, ex) => acc + (ex.series ?? 0), 0),
    secaoAtual          : atual?.secao ?? null,
    proximaSecao        : proxSecao?.secao ?? null,
    finalizado,
  }
}