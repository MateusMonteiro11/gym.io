import { useEffect, useState } from 'react'
import {
  listarAgendamentosUsuario,
  excluirAgendamento,
} from '../services/agendamentos/agendamentosService'
import { useAuth } from './useAuth'

export function useAgendamentos() {
  const { usuario } = useAuth()
  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function carregar() {
      if (!usuario?.id) {
        setAgendamentos([])
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const dados = await listarAgendamentosUsuario(usuario.id)
        if (active) setAgendamentos(dados || [])
      } catch (error) {
        if (active) console.error('Erro ao carregar agendamentos:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    carregar()

    return () => {
      active = false
    }
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

  const excluir = async (idAgendamento) => {
    if (!usuario?.id) return
    try {
      await excluirAgendamento(idAgendamento)
      await recarregar()
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error)
      throw error
    }
  }

  return {
    agendamentos,
    loading,
    recarregar,
    excluirAgendamento: excluir,
  }
}
