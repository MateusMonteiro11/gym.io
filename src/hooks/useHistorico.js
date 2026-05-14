import { useState, useEffect, useMemo } from 'react'
import { listarHistoricos } from '../services/historico/historicoTreinosService'
import { parseDateTime } from '../utils/dateUtils'

export function useHistorico(idUsuario) {

  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const carregarHistorico = async () => {

    if (!idUsuario) return

    setLoading(true)
    setErro(null)

    try {

      const dados = await listarHistoricos(idUsuario)

      console.log('[useHistorico] Dados recebidos:', dados)

      setHistorico(dados || [])

    } catch (err) {

      console.error(
        '[useHistorico] Erro ao carregar histórico:',
        err
      )

      setErro(
        err?.message ?? 'Erro ao carregar histórico'
      )

    } finally {

      setLoading(false)

    }
  }

  useEffect(() => {

    carregarHistorico()

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
          treino.total_series || 0
        )

      }, 0)

    const duracaoTotal =
      historico.reduce((acc, treino) => {

        console.log(
          '[duracao_segundos]',
          treino.duracao_segundos
        )

        return acc + Number(
          treino.duracao_segundos || 0
        )

      }, 0)

    const mediaSegundos =
      totalTreinos > 0
        ? Math.round(duracaoTotal / totalTreinos)
        : 0

    const duracaoMedia =
      mediaSegundos >= 60
        ? `${(mediaSegundos / 60).toFixed(1)} min`
        : `${mediaSegundos}s`

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