/**
 * @typedef {Object} ExercicioFlat
 * @property {number}      id_treino_exercicio
 * @property {number}      id_exercicio
 * @property {string}      nome
 * @property {string}      descricao
 * @property {string|null} imagem
 * @property {string|null} video
 * @property {string}      secao
 * @property {number}      id_secao
 * @property {number}      ordemSecao
 * @property {number}      series
 * @property {number}      repeticoes
 * @property {number}      carga
 * @property {number}      descanso
 * @property {number}      ordem
 * @property {number}      ordemGlobal
 */

// Metodo flatten sugerido
// Implementar lógica de ordenação por 'ordem' e 'ordemSecao' para garantir a sequência correta dos exercícios no treino.
// A ordenação deve considerar primeiro a 'ordemSecao' para agrupar os exercícios por seção, e depois a 'ordem' para ordenar os exercícios dentro de cada seção.

/**
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
        series              : Number(item.series)            || 1,
        repeticoes          : Number(item.repeticoes)        || 0,
        carga               : Number(item.carga)             || 0,
        descanso            : Number(item.descanso_segundos) || 60,
        ordem               : Number(item.ordem)             || 0,
      })
    })
  })

  // Injeta a posição global após a ordenação definitiva
  return exercicios.map((ex, i) => ({ ...ex, ordemGlobal: i }))
}

/**
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
 * @param {ExercicioFlat[]} exercicios
 * @param {number} index
 * @returns {boolean}
 */

export function treinoFinalizado(exercicios, index) {
  if (!Array.isArray(exercicios) || exercicios.length === 0) return true
  return index >= exercicios.length
}

/**
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
 * Retorna um sumário geral do treino antes de iniciá-lo.
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
