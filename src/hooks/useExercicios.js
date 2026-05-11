// Não implementado ainda, apenas estrutura para futura integração com Supabase --- IGNORE ---

import { useEffect, useState } from 'react'
import exerciciosService from '../services/exerciciosService'

export const useExercicios = () => {
  const [exercicios, setExercicios] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchExercicios = async () => {
    setLoading(true)
    await exerciciosService.getAll()
    setLoading(false)
  }

  useEffect(() => {
    fetchExercicios()
  }, [])

  return {
    exercicios,
    loading,
    fetchExercicios,
  }
}
