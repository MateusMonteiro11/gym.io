import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import logoImg from '../assets/images/Logo.png'

import { login, resetPassword } from '../services/auth/authService'

export default function Login() {

  const navigate = useNavigate()

  const [email, setEmail] =
    useState('')

  const [senha, setSenha] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  async function handleLogin(e) {

    e.preventDefault()

    try {

      setLoading(true)

      await login(email, senha)

      navigate('/dashboard')

    } catch (error) {

      alert(error.message)

    } finally {

      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()

    try {
      setResetLoading(true)
      await resetPassword(resetEmail)
      alert('Email de redefinição enviado! Verifique sua caixa de entrada.')
      setIsModalOpen(false)
      setResetEmail('')
    } catch (error) {
      alert(error.message)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="bg-gray-200 min-h-screen flex items-center justify-center">

      <div className="bg-white w-full max-w-6xl min-h-[80vh] mx-auto rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row items-stretch">

        {/* Lado azul */}
        <div className="bg-[#1457F7] text-white flex flex-col p-6 md:p-10 md:w-1/2">

          <div className="w-full max-w-lg flex flex-col items-center justify-center text-center h-full">

            <img
              src={logoImg}
              alt="Logo"
              className="w-28 md:w-56 mb-8 mx-auto"
            />

            <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
              GYM.IO
            </h1>

            <p className="mb-6 text-base font-bold md:text-lg">
              Gerencie seus treinos com eficiência
            </p>

            <ul className="text-sm md:text-base space-y-2">
              <li>• Crie seções interativas</li>
              <li>• Agende seus treinos</li>
              <li>• Molde treinos personalizados</li>
            </ul>

          </div>

        </div>

        {/* Lado branco */}
        <div className="flex flex-col p-6 md:p-10 md:w-1/2">

          <div className="w-full max-w-md flex flex-col items-center justify-center text-center h-full mx-auto">

            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              Bem-vindo de Volta !
            </h2>

            <p className="text-gray-600 mb-6">
              Acesse sua conta para gerenciar seus treinos
            </p>

            {/* FORM */}
            <form
              onSubmit={handleLogin}
              className="space-y-4 w-full max-w-sm"
            >

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="password"
                placeholder="Senha"
                value={senha}
                onChange={(e) =>
                  setSenha(e.target.value)
                }
                className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex justify-end items-center text-sm">

                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="text-blue-600 hover:underline"
                >
                  Esqueceu a senha?
                </button>

              </div>

              <button
                type="submit"
                disabled={loading}
                className="block w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition text-center disabled:opacity-50"
              >

                {loading
                  ? 'Entrando...'
                  : 'Entrar →'}

              </button>

              <p className="text-sm text-center mt-4">

                Não tem uma conta?{' '}

                <Link
                  to="/cadastro"
                  className="text-blue-600 hover:underline"
                >
                  Criar uma
                </Link>

              </p>

            </form>

          </div>

        </div>

      </div>

      {/* Modal para Esqueceu a Senha */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Redefinir Senha</h3>
            <form onSubmit={handleResetPassword}>
              <input
                type="email"
                placeholder="Digite seu email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-4 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {resetLoading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}