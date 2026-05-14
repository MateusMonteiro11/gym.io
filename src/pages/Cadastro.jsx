import { useState } from 'react'

import {
  Link,
  useNavigate
} from 'react-router-dom'

import cadastroImg from '../assets/images/Cadastro.png'

import {
  cadastrar
} from '../services/auth/authService'

export default function Cadastro() {

  const navigate = useNavigate()

  const [nome, setNome] =
    useState('')

  const [email, setEmail] =
    useState('')

  const [senha, setSenha] =
    useState('')

  const [confirmarSenha,
    setConfirmarSenha] =
      useState('')

  const [loading, setLoading] =
    useState(false)

  async function handleCadastro(e) {

    e.preventDefault()

    if (senha !== confirmarSenha) {

      alert('As senhas não coincidem')

      return
    }

    try {

      setLoading(true)

      await cadastrar({
        nome,
        email,
        senha
      })

      alert('Conta criada com sucesso!')

      navigate('/login')

    } catch (error) {

      alert(error.message)

    } finally {

      setLoading(false)
    }
  }

  return (

    <div className="bg-gray-200 min-h-screen flex items-center justify-center">

      <div className="bg-white w-full max-w-6xl min-h-[80vh] mx-auto rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

        {/* Lado azul */}
        <div className="bg-[#1457F7] text-white flex flex-col p-6 md:p-10 md:w-1/2">

          <div className="w-full flex flex-col items-center justify-center text-center h-full">

            <img
              src={cadastroImg}
              alt="Logo"
              className="w-40 md:w-72 mb-10"
            />

            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
              COMECE AGORA !
            </h1>

            <p className="text-lg md:text-xl font-semibold mb-6">
              Inicie sua jornada de treinos conosco
            </p>

            <p className="text-base opacity-90">
              É prático, rápido e seguro
            </p>

          </div>

        </div>

        {/* Lado branco */}
        <div className="flex flex-col p-6 md:p-10 md:w-1/2">

          <div className="w-full max-w-md flex flex-col justify-center h-full mx-auto">

            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
              Cadastro
            </h2>

            {/* FORM */}
            <form
              onSubmit={handleCadastro}
              className="space-y-4"
            >

              <input
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) =>
                  setNome(e.target.value)
                }
                className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={(e) =>
                  setSenha(e.target.value)
                }
                className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="password"
                placeholder="Repita sua senha"
                value={confirmarSenha}
                onChange={(e) =>
                  setConfirmarSenha(e.target.value)
                }
                className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="space-y-3 text-sm">

                <label className="flex items-center gap-2">

                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600"
                    required
                  />

                  Concordo com os termos

                </label>

              </div>

              <button
                type="submit"
                disabled={loading}
                className="block w-full bg-[#1457F7] text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition text-center disabled:opacity-50"
              >

                {loading
                  ? 'Criando conta...'
                  : 'Criar a conta'}

              </button>

              <p className="text-sm text-center mt-4">

                Já possui uma conta?{' '}

                <Link
                  to="/login"
                  className="text-blue-600 hover:underline"
                >
                  Entrar
                </Link>

              </p>

            </form>

          </div>

        </div>

      </div>

    </div>
  )
}