// Não implementado ainda, apenas estrutura para futura integração com Supabase --- IGNORE ---

import { useEffect, useState } from 'react'
import treinosService from '../services/treinosService'

export const useTreinos = () => {
  const [treinos, setTreinos] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchTreinos = async () => {
    setLoading(true)
    await treinosService.getAll()
    setLoading(false)
  }

  useEffect(() => {
    fetchTreinos()
  }, [])

  return {
    treinos,
    loading,
    fetchTreinos,
  }
}
