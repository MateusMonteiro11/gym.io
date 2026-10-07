import { useState, useEffect, useMemo, useRef } from 'react'
import { listarHistoricos } from '../services/historico/historicoTreinosService'
import { parseDateTime } from '../utils/dateUtils'
import { formatAverageWorkoutDuration } from '../utils/workoutDuration.js'
import { logError } from '../utils/errorMessages'

export function useHistorico(idUsuario) {

  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const requestIdRef = useRef(0)

  const carregarHistorico = async () => {
    const requestId = ++requestIdRef.current

    if (!idUsuario) {
      setHistorico([])
      setErro(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setErro(null)

    try {

      const dados = await listarHistoricos(idUsuario)
      if (requestId !== requestIdRef.current) return
      setHistorico(dados || [])

    } catch (err) {

      if (requestId !== requestIdRef.current) return

      logError(err, '[useHistorico] Failed to load history')

      setErro(
        'Erro ao carregar histórico'
      )

    } finally {

      if (requestId === requestIdRef.current) setLoading(false)

    }
  }

  useEffect(() => {

    carregarHistorico()

    return () => {
      requestIdRef.current += 1
    }

  }, [idUsuario])

  const estatisticas = useMemo(() => {

    if (!historico.length) {

      return {
        totalTreinos     : 0,
        totalExercicios  : 0,
        duracaoMedia     : 0,
        diasSemanais     : 0,
      }

    }

    const agora = Date.now()

    const umaSemana =
      7 * 24 * 60 * 60 * 1000

    const totalTreinos =
      historico.length

    const totalExercicios =
      historico.reduce((acc, treino) => {

        return acc + Number(
          treino.total_exercicios || 0
        )

      }, 0)

    const duracaoTotal =
      historico.reduce((acc, treino) => {
        return acc + Number(
          treino.duracao_segundos || 0
        )
      }, 0)

    const mediaSegundos =
      totalTreinos > 0
        ? duracaoTotal / totalTreinos
        : 0

    const duracaoMedia = formatAverageWorkoutDuration(mediaSegundos)

    const diasSemanais = new Set(

      historico
        .filter((treino) => {

          const dataExecucao =
            parseDateTime(treino.data_execucao)?.getTime() ?? 0

          return (
            agora - dataExecucao
          ) <= umaSemana

        })
        .map((treino) => {

          return new Date(
            treino.data_execucao
          ).toLocaleDateString('pt-BR')

        })

    ).size

    return {

      totalTreinos,

      totalExercicios,

      duracaoMedia,

      diasSemanais,

    }

  }, [historico])

  const agruparPorMes = () => {

    if (!historico.length) return {}

    const agrupado = {}

    historico.forEach((treino) => {

      const data = parseDateTime(
        treino.data_execucao
      )

      if (!data || Number.isNaN(data.getTime())) return

      const chave =
        `${data.getFullYear()}-${String(
          data.getMonth() + 1
        ).padStart(2, '0')}`

      const mes = data.toLocaleString(
        'pt-BR',
        {
          month: 'long',
          year : 'numeric',
        }
      )

      if (!agrupado[chave]) {

        agrupado[chave] = {
          mes,
          treinos: [],
        }

      }

      agrupado[chave].treinos.push(treino)

    })

    return agrupado
  }

  return {

    historico,

    loading,

    erro,

    estatisticas,

    agruparPorMes,

    recarregar: carregarHistorico,

  }
}
