import { useEffect, useState } from 'react'
import { listarAgendamentosUsuario } from '../services/agendamentos/agendamentosService'
import { useAuth } from './useAuth'

export function useAgendamentos() {
  const { usuario } = useAuth()
  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      try {
        if (!usuario?.id) return

        const dados = await listarAgendamentosUsuario(usuario.id)
        setAgendamentos(dados)
      } catch (error) {
        console.error('Erro ao carregar agendamentos:', error)
      } finally {
        setLoading(false)
      }
    }

    carregar()
  }, [usuario?.id])

  const recarregar = async () => {
    if (!usuario?.id) return
    try {
      const dados = await listarAgendamentosUsuario(usuario.id)
      setAgendamentos(dados)
    } catch (error) {
      console.error('Erro ao recarregar agendamentos:', error)
    }
  }

  return {
    agendamentos,
    loading,
    recarregar,
  }
}
