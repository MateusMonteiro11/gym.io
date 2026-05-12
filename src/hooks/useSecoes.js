import { useState } from 'react'

import {
  criarSecao,
  atualizarSecao,
  deletarSecao
} from '../services/treinos/secoesService'

export function useSecoes(initialState = []) {

  const [secoes, setSecoes] =
    useState(initialState)

  async function adicionarSecao(payload) {

    const novaSecao =
      await criarSecao(payload)

    setSecoes((prev) => [
      ...prev,
      novaSecao
    ])
  }

  async function editarSecao(id, payload) {

    const atualizada =
      await atualizarSecao(id, payload)

    setSecoes((prev) =>
      prev.map((secao) =>
        secao.id_secao === id
          ? atualizada
          : secao
      )
    )
  }

  async function removerSecao(id) {

    await deletarSecao(id)

    setSecoes((prev) =>
      prev.filter((s) =>
        s.id_secao !== id
      )
    )
  }

  return {
    secoes,
    setSecoes,
    adicionarSecao,
    editarSecao,
    removerSecao
  }
}