import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Formata segundos em "MM:SS" ou "HH:MM:SS" quando ≥ 1 hora.
 * @param {number} totalSeconds
 * @returns {string}
 */

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

/**
 * @typedef {Object} WorkoutTimerReturn
 * @property {number}   elapsed    - Segundos decorridos
 * @property {boolean}  isRunning  - Se o timer está ativo
 * @property {string}   formatted  - Tempo formatado "MM:SS" ou "HH:MM:SS"
 * @property {Function} start      - Inicia o timer
 * @property {Function} pause      - Pausa o timer
 * @property {Function} toggle     - Alterna entre start/pause
 * @property {Function} reset      - Zera e para o timer
 */

/**
 * @param {Object}  [options]
 * @param {boolean} [options.autoStart=false]  - Inicia automaticamente ao montar
 * @param {number}  [options.initialElapsed=0] - Segundos iniciais (retomada de sessão)
 * @returns {WorkoutTimerReturn}
 */

export function useWorkoutTimer({ autoStart = false, initialElapsed = 0 } = {}) {
  const [elapsed,   setElapsed]   = useState(initialElapsed)
  const [isRunning, setIsRunning] = useState(autoStart)
  const intervalRef               = useRef(null)

  // Mantém a referência de isRunning atualizada sem recriar o efeito
  const isRunningRef = useRef(isRunning)
  isRunningRef.current = isRunning

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(
        () => setElapsed((prev) => prev + 1),
        1000
      )
    } else {
      clearInterval(intervalRef.current)
    }

    return () => clearInterval(intervalRef.current)
  }, [isRunning])

  // Limpa ao desmontar
  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  const start  = useCallback(() => setIsRunning(true),  [])
  const pause  = useCallback(() => setIsRunning(false), [])
  const toggle = useCallback(() => setIsRunning((prev) => !prev), [])
  const reset  = useCallback(() => {
    setIsRunning(false)
    setElapsed(0)
  }, [])

  return {
    elapsed,
    isRunning,
    formatted : formatElapsed(elapsed),
    start,
    pause,
    toggle,
    reset,
  }
}