import { useEffect, useState } from 'react'

import {
  listarTreinos
} from '../services/treinos/treinosService'

import { useAuth } from './useAuth'

export function useTreino() {

  const { usuario } = useAuth()

  const [treinosSistema, setTreinosSistema] = useState([])
  const [meusTreinos, setMeusTreinos] = useState([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function carregar() {

      try {

        if (!usuario?.id) return

        const treinos =
          await listarTreinos(usuario.id)

        const sistema =
          treinos.filter(
            treino => treino.tipo === 'sistema'
          )

        const usuarioTreinos =
          treinos.filter(
            treino => treino.tipo === 'usuario'
          )

        setTreinosSistema(sistema)
        setMeusTreinos(usuarioTreinos)

      } catch (error) {

        console.error(error)

      } finally {

        setLoading(false)
      }
    }

    carregar()

  }, [usuario])

  return {
    treinosSistema,
    meusTreinos,
    loading
  }
}