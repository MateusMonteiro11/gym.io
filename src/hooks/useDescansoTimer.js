// ─────────────────────────────────────────────
// useDescansoTimer.js
// Timer de descanso entre séries
// ─────────────────────────────────────────────
//
// Responsabilidade: fazer a contagem regressiva
// do intervalo entre séries e notificar quando
// acabar. Não conhece o treino, só conta.
//
// Ciclo de vida esperado:
//   1. usuário conclui uma série
//   2. useTreinoAtivo chama `iniciarDescanso(segundos)`
//   3. DescansoModal renderiza com os dados deste hook
//   4. ao zerar → `onFim` é chamado → modal fecha
//
// Uso:
//   const { ativo, restante, percentual, progresso,
//           iniciarDescanso, pularDescanso } = useDescansoTimer({ onFim })

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * @typedef {Object} DescansoTimerReturn
 * @property {boolean}  ativo          - Se há descanso em andamento
 * @property {number}   restante       - Segundos restantes
 * @property {number}   total          - Duração total configurada (segundos)
 * @property {number}   percentual     - Percentual restante (100 → 0)
 * @property {string}   formatted      - Tempo formatado "MM:SS"
 * @property {Function} iniciarDescanso - (segundos?: number) => void
 * @property {Function} pularDescanso   - Encerra imediatamente e chama onFim
 * @property {Function} adicionarTempo  - (segundos: number) => void — adiciona tempo ao restante
 */

/**
 * @param {Object}    [options]
 * @param {Function}  [options.onFim]              - Callback ao zerar o timer
 * @param {number}    [options.duracaoPadrao=60]   - Segundos padrão se nenhum for passado
 * @returns {DescansoTimerReturn}
 */
export function useDescansoTimer({ onFim, duracaoPadrao = 60 } = {}) {
  const [ativo,     setAtivo]     = useState(false)
  const [restante,  setRestante]  = useState(0)
  const [total,     setTotal]     = useState(0)

  const intervalRef = useRef(null)
  const onFimRef    = useRef(onFim)
  onFimRef.current  = onFim   // mantém referência estável

  // Limpa intervalo ao desmontar
  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  // Contagem regressiva
  useEffect(() => {
    if (!ativo) {
      clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setRestante((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setAtivo(false)
          onFimRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [ativo])

  const iniciarDescanso = useCallback((segundos) => {
    const duracao = segundos ?? duracaoPadrao
    clearInterval(intervalRef.current)
    setTotal(duracao)
    setRestante(duracao)
    setAtivo(true)
  }, [duracaoPadrao])

  const pularDescanso = useCallback(() => {
    clearInterval(intervalRef.current)
    setAtivo(false)
    setRestante(0)
    onFimRef.current?.()
  }, [])

  const adicionarTempo = useCallback((segundos) => {
    setRestante((prev) => prev + segundos)
    setTotal((prev) => prev + segundos)
  }, [])

  const reset = useCallback(() => {

    clearInterval(intervalRef.current)

    setAtivo(false)
    setRestante(0)
    setTotal(0)

  }, [])

  const removerTempo = useCallback((segundos) => {

    setRestante((prev) =>
      Math.max(prev - segundos, 0)
    )

    setTotal((prev) =>
      Math.max(prev - segundos, 0)
    )

  }, [])

  const percentual = total > 0
    ? Math.round((restante / total) * 100)
    : 0

  const formatted = (() => {
    const m = String(Math.floor(restante / 60)).padStart(2, '0')
    const s = String(restante % 60).padStart(2, '0')
    return `${m}:${s}`
  })()

  return {
    ativo,
    restante,
    total,
    percentual,
    formatted,
    iniciarDescanso,
    pularDescanso,
    adicionarTempo,
    removerTempo,
    reset,
  }
}