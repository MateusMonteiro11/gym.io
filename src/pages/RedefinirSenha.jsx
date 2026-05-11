import { useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { supabase } from '../lib/supabase'

export default function RedefinirSenha() {

  const navigate = useNavigate()

  const [senha, setSenha] =
    useState('')

  const [confirmarSenha, setConfirmarSenha] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  async function handleSubmit(e) {

    e.preventDefault()

    if (senha !== confirmarSenha) {
      alert('As senhas não coincidem')
      return
    }

    try {

      setLoading(true)

      const { error } =
        await supabase.auth.updateUser({
          password: senha
        })

      if (error) throw error

      alert('Senha alterada com sucesso!')

      navigate('/login')

    } catch (error) {

      alert(error.message)

    } finally {

      setLoading(false)
    }
  }

  return (

    <div className="min-h-screen bg-gray-100 flex items-center justify-center">

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">

        <h1 className="text-3xl font-bold mb-6 text-center">
          Redefinir senha
        </h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          <input
            type="password"
            placeholder="Nova senha"
            value={senha}
            onChange={(e) =>
              setSenha(e.target.value)
            }
            className="w-full border border-gray-300 rounded-xl p-4"
          />

          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmarSenha}
            onChange={(e) =>
              setConfirmarSenha(e.target.value)
            }
            className="w-full border border-gray-300 rounded-xl p-4"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >

            {loading
              ? 'Alterando...'
              : 'Alterar senha'}

          </button>

        </form>

      </div>

    </div>
  )
}