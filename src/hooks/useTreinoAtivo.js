// ─────────────────────────────────────────────
// useTreinoAtivo.js
// Orquestrador do sistema de treino ativo
// ─────────────────────────────────────────────
//
// É o único hook que os componentes de treino
// precisam consumir. Coordena:
//   • navegação entre exercícios e séries
//   • disparo do descanso após cada série
//   • progresso e estado derivado
//   • salvamento do histórico ao finalizar
//
// Fluxo de uma série:
//   concluirSerie()
//     ├─ registra a série no log interno
//     ├─ se ainda há séries → iniciarDescanso(ex.descanso)
//     │     └─ ao fim do descanso → serieAtual++
//     └─ se era a última série → avançarExercicio()
//           └─ se era o último exercício → finalizarTreino()
//
// Uso:
//   const treino = useTreinoAtivo({ treino: dadosDoBanco, idUsuario })
//   // → desestruturar o que cada componente precisa

import { useState, useCallback, useMemo } from 'react'
import { useWorkoutTimer }  from './useWorkoutTimer'
import { useDescansoTimer } from './useDescansoTimer'
import {
  flattenTreino,
  obterExercicioAtual,
  obterProximosExercicios,
  obterProximaSecao,
  calcularSumarioTreino,
  treinoFinalizado,
} from '../utils/treinoUtils'

// ─── Tipos (JSDoc) ───────────────────────────

/**
 * @typedef {Object} RegistroSerie
 * @property {number} id_treino_exercicio
 * @property {number} id_exercicio
 * @property {number} serie          - Número da série (1-based)
 * @property {number} cargaUtilizada
 * @property {number} repeticoesFeit as
 * @property {number} timestamp      - Date.now()
 */

/**
 * @typedef {'idle'|'ativo'|'descansando'|'finalizado'} StatusTreino
 */

// ─── Hook ────────────────────────────────────

/**
 * @param {Object}  options
 * @param {Object}  options.treino      - Objeto completo do treino vindo do Supabase
 * @param {string}  options.idUsuario   - UUID do usuário autenticado
 * @param {number}  [options.descansoPadrao=60] - Tempo padrão de descanso em segundos
 * @param {Function} [options.onFinalizar] - Callback após salvar o histórico
 */

export function useTreinoAtivo({ treino, idUsuario, descansoPadrao = 60, onFinalizar }) {

  // ── Lista plana de exercícios (memoizada) ──
  const exercicios = useMemo(
    () => flattenTreino(treino),
    [treino]
  )

  const sumario = useMemo(
    () => calcularSumarioTreino(exercicios),
    [exercicios]
  )

  // ── Estado de navegação ────────────────────
  const [indexAtual,  setIndexAtual]  = useState(0)
  const [serieAtual,  setSerieAtual]  = useState(1)
  const [status,      setStatus]      = useState(/** @type {StatusTreino} */ ('idle'))

  // ── Log de séries realizadas ───────────────
  // Usado para montar o payload do historico_exercicios
  const [logSeries, setLogSeries] = useState(/** @type {RegistroSerie[]} */ ([]))

  // ── Salvamento ────────────────────────────
  const [salvando,  setSalvando]  = useState(false)
  const [erro,      setErro]      = useState(null)

  // ── Timers ────────────────────────────────
  const continuarSerie = useCallback(() => {
    setSerieAtual((prev) => prev + 1)
    setStatus('ativo')
  }, [])

  const workoutTimer = useWorkoutTimer({ autoStart: false })

  const descansoTimer = useDescansoTimer({
    onFim: continuarSerie,
  })

  // ── Dados derivados (estado atual) ────────
  const exercicioAtual  = obterExercicioAtual(exercicios, indexAtual)
  const proximaSecao    = obterProximaSecao(exercicios, indexAtual)
  const finalizado      = treinoFinalizado(exercicios, indexAtual)
  const [tempoDescanso, setTempoDescanso] = useState(descansoPadrao ?? 60)
  const proximoExercicios = useMemo(() => {

    return exercicios.slice(
      indexAtual + 1,
      indexAtual + 4
    )

  }, [exercicios, indexAtual])

  const estado = useMemo(() => {

    const totalExercicios = exercicios.length

    const exerciciosFeitos = indexAtual

    const exerciciosRestantes =
      totalExercicios - indexAtual - 1

    const totalSeries = exercicios.reduce(
      (acc, ex) => acc + (ex.series || 0),
      0
    )

    const seriesFeitas = exercicios.reduce((acc, ex, idx) => {

      if (idx < indexAtual) {
        return acc + (ex.series || 0)
      }

      if (idx === indexAtual) {
        return acc + (serieAtual - 1)
      }

      return acc

    }, 0)

    const seriesRestantes =
      totalSeries - seriesFeitas

    const percentual =
      totalExercicios > 0
        ? Math.round(
            (exerciciosFeitos / totalExercicios) * 100
          )
        : 0

    return {

      percentual,

      totalExercicios,

      exerciciosFeitos,

      exerciciosRestantes,

      totalSeries,

      seriesRestantes,

      secaoAtual:
        exercicioAtual?.secao || 'Treino',

      proximaSecao:
        proximoExercicios?.[0]?.secao || null,
    }

  }, [
    exercicios,
    indexAtual,
    serieAtual,
    exercicioAtual,
    proximoExercicios
  ])

  // ─── Ações ─────────────────────────────────

  /** Inicia o treino (idle → ativo) */
  const iniciarTreino = useCallback((tempo = 60) => {

    if (status !== 'idle') return

    console.log('[useTreinoAtivo] Iniciando treino, status anterior:', status)

    setTempoDescanso(tempo)

    setStatus('ativo')

    workoutTimer.start()

    console.log('[useTreinoAtivo] Timer iniciado, elapsed:', workoutTimer.elapsed)

  }, [status, workoutTimer])

  /**
   * Registra a conclusão de uma série.
   * Aceita ajustes de carga/reps caso o usuário tenha editado no momento.
   *
   * @param {Object} [ajustes]
   * @param {number} [ajustes.carga]      - Carga efetivamente usada
   * @param {number} [ajustes.repeticoes] - Reps efetivamente feitas
   */
  const concluirSerie = useCallback((ajustes = {}) => {
    if (!exercicioAtual || status !== 'ativo') return

    // Registra no log
    const registro = {
      id_treino_exercicio : exercicioAtual.id_treino_exercicio,
      id_exercicio        : exercicioAtual.id_exercicio,
      serie               : serieAtual,
      cargaUtilizada      : ajustes.carga      ?? exercicioAtual.carga,
      repeticoesFeitas    : ajustes.repeticoes ?? exercicioAtual.repeticoes,
      timestamp           : Date.now(),
    }

    setLogSeries((prev) => [...prev, registro])

    const eraUltimaSerie = serieAtual >= exercicioAtual.series

    if (eraUltimaSerie) {
      // Avança para o próximo exercício
      _avancarExercicio()
    } else {
      // Inicia descanso; ao fim, serieAtual++ (via callback do useDescansoTimer)
      setStatus('descansando')
      descansoTimer.iniciarDescanso(tempoDescanso)
    }
  }, [exercicioAtual, serieAtual, status, descansoTimer])

  /**
   * Pula o descanso atual e vai direto para a próxima série.
   * Delega ao descansoTimer, que chama onFim → serieAtual++
   */
  const pularDescanso = useCallback(() => {

    descansoTimer.reset() // garante que não há descanso pendente

    setSerieAtual((prev) => prev + 1)

    setStatus('ativo')

  }, [descansoTimer])

  /**
   * Avança manualmente para o próximo exercício,
   * ignorando séries restantes (ex.: exercício abandonado).
   */
  const avancarExercicio = useCallback(() => {
    _avancarExercicio()
  }, [indexAtual, exercicios])

  /**
   * Finaliza o treino imediatamente, independente do progresso.
   */
  const finalizarTreino = useCallback(async () => {
    if (status === 'finalizado') return

    console.log('[useTreinoAtivo] Finalizando treino, elapsed:', workoutTimer.elapsed, 'status:', status)

    workoutTimer.pause()
    descansoTimer.reset() // garante que não há descanso pendente
    setStatus('finalizado')

    console.log(workoutTimer.elapsed)

    await _salvarHistorico()
  }, [status, workoutTimer, descansoTimer, logSeries] )

  // ─── Internos ──────────────────────────────

  /** Avança para o próximo exercício ou finaliza o treino */
  function _avancarExercicio() {

    descansoTimer.reset() // Garante que não há descanso pendente

    const proximoIndex = indexAtual + 1

    if (treinoFinalizado(exercicios, proximoIndex)) {

      workoutTimer.pause()

      setStatus('finalizado')

      setIndexAtual(proximoIndex)

      _salvarHistorico()

    } else {

      setIndexAtual(proximoIndex)

      setSerieAtual(1)

      setStatus('ativo')
    }
  }

  /**
   * Monta o payload e persiste no Supabase.
   * Retorna silenciosamente em caso de erro (seta `erro`).
   */
  async function _salvarHistorico() {
    if (!idUsuario || !treino?.id_treino) return

    setSalvando(true)
    setErro(null)

    console.log('[_salvarHistorico] Iniciando salvamento, elapsed atual:', workoutTimer.elapsed)

    try {
      const { salvarHistoricoTreino } = await import(
        '../services/treino_ativo/treinoAtivoService'
      )

      await salvarHistoricoTreino({
        idUsuario,
        idTreino         : treino.id_treino,
        duracaoSegundos  : workoutTimer.elapsed,
        logSeries,
      })

      console.log('[_salvarHistorico] Treino salvo com sucesso')

      onFinalizar?.()
    } catch (err) {
      console.error('[useTreinoAtivo] Erro ao salvar histórico:', err)
      setErro(err?.message ?? 'Erro ao salvar treino.')
    } finally {
      setSalvando(false)
    }
  }


  // ─── Retorno público ───────────────────────
  return {
    // ── Estado geral ──
    status,
    salvando,
    erro,

    // ── Lista e navegação ──
    exercicios,
    indexAtual,
    serieAtual,
    exercicioAtual,
    proximoExercicios,
    proximaSecao,
    finalizado,

    // ── Progresso e estatísticas ──
    estado,    // { percentual, exerciciosFeitos, exerciciosRestantes, seriesRestantes, ... }
    sumario,   // { totalExercicios, totalSeries, totalSecoes, tempoEstimadoMin, secoes }

    // ── Timers ──
    workoutTimer,   // { elapsed, isRunning, formatted, start, pause, toggle, reset }
    descansoTimer,  // { ativo, restante, total, percentual, formatted, iniciarDescanso, pularDescanso, adicionarTempo }
    tempoDescanso,

    // ── Ações ──
    iniciarTreino,
    concluirSerie,
    pularDescanso,
    avancarExercicio,
    finalizarTreino,
    continuarSerie,
    setTempoDescanso,
  }
}