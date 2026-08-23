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
    let active = true

    async function carregar() {
      if (!usuario?.id) {
        setTreinosSistema([])
        setMeusTreinos([])
        setLoading(false)
        return
      }

      setLoading(true)

      try {

        const treinos =
          await listarTreinos(usuario.id)

        if (!active) return

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

        if (active) console.error(error)

      } finally {

        if (active) setLoading(false)
      }
    }

    carregar()

    return () => {
      active = false
    }

  }, [usuario?.id])

  return {
    treinosSistema,
    meusTreinos,
    loading
  }
}
