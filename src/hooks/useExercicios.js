import { useState } from 'react'

import {
  adicionarExercicioTreino,
  atualizarExercicioTreino,
  deletarExercicioTreino
} from '../services/treinos/treinosExerciciosService'

export function useExercicios(initialState = []) {

  const [exercicios, setExercicios] =
    useState(initialState)

  async function adicionar(payload) {

    const novo =
      await adicionarExercicioTreino(payload)

    setExercicios((prev) => [
      ...prev,
      novo
    ])
  }

  async function editar(id, payload) {

    const atualizado =
      await atualizarExercicioTreino(
        id,
        payload
      )

    setExercicios((prev) =>
      prev.map((exercicio) =>
        exercicio.id_treino_exercicio === id
          ? atualizado
          : exercicio
      )
    )
  }

  async function remover(id) {

    await deletarExercicioTreino(id)

    setExercicios((prev) =>
      prev.filter((e) =>
        e.id_treino_exercicio !== id
      )
    )
  }

  return {
    exercicios,
    adicionar,
    editar,
    remover
  }
}