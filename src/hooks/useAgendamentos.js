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
        if (!usuario?.id_usuario) return

        const dados = await listarAgendamentosUsuario(usuario.id_usuario)
        setAgendamentos(dados)
      } catch (error) {
        console.error('Erro ao carregar agendamentos:', error)
      } finally {
        setLoading(false)
      }
    }

    carregar()
  }, [usuario?.id_usuario])

  const recarregar = async () => {
    if (!usuario?.id_usuario) return
    try {
      const dados = await listarAgendamentosUsuario(usuario.id_usuario)
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
