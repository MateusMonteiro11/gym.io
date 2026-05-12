import { useEffect, useState } from 'react'

import {
  buscarTreinoPorId
} from '../services/treinos/treinosService'

import {
  listarSecoesTreino
} from '../services/treinos/secoesService'

import {
  listarExerciciosTreino
} from '../services/treinos/treinosExerciciosService'

export function useTreinoDetalhes(idTreino) {

  const [treino, setTreino] = useState(null)

  const [secoes, setSecoes] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  async function carregarTreino() {

    try {

      setLoading(true)

      const treinoData =
        await buscarTreinoPorId(idTreino)

      const secoesData =
        await listarSecoesTreino(idTreino)

      const secoesComExercicios =
        await Promise.all(

          secoesData.map(async (secao) => {

            const exercicios =
              await listarExerciciosTreino(
                secao.id_secao
              )

            return {
              ...secao,
              exercicios
            }
          })
        )

      setTreino(treinoData)
      setSecoes(secoesComExercicios)

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)
    }
  }

  useEffect(() => {

    if (idTreino) {
      carregarTreino()
    }

  }, [idTreino])

  return {
    treino,
    secoes,
    loading,
    carregarTreino
  }
}