import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoImg from '../assets/images/logo.png'
import { login, resetPassword } from '../services/auth/authService'
import { useUi } from '../contexts/UiContext'
import AuthShell from '../components/ui/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ModalHeader from '../components/ui/ModalHeader'
export default function Login() {
  const navigate = useNavigate()
  const { alert, notify } = useUi()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [resetErrors, setResetErrors] = useState({})

  function validarFormulario() {
    const novoErros = {}

    if (!email.trim()) novoErros.email = 'Digite seu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) novoErros.email = 'Email inválido'

    if (!senha) novoErros.senha = 'Digite sua senha'

    setErrors(novoErros)
    return Object.keys(novoErros).length === 0
  }

  function validarResetEmail() {
    const novoErros = {}

    if (!resetEmail.trim()) novoErros.resetEmail = 'Digite seu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) novoErros.resetEmail = 'Email inválido'

    setResetErrors(novoErros)
    return Object.keys(novoErros).length === 0
  }

  async function handleLogin(e) {
    e.preventDefault()

    if (!validarFormulario()) return

    try {
      setLoading(true)
      await login(email, senha)
      navigate('/dashboard')
    } catch (error) {
      alert({ title: 'Erro ao entrar', message: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()

    if (!validarResetEmail()) return

    try {
      setResetLoading(true)
      await resetPassword(resetEmail)
      notify({
        title: 'Email enviado',
        message: 'Verifique sua caixa de entrada para redefinir a senha.',
        type: 'success',
      })
      setIsModalOpen(false)
      setResetEmail('')
      setResetErrors({})
    } catch (error) {
      alert({ title: 'Erro', message: error.message, type: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <>
      <AuthShell
        brand={
          <>
            <img src={logoImg} alt="GYM.IO" className="mx-auto mb-8 w-28 md:w-48" />
            <h1 className="mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">GYM.IO</h1>
            <p className="mb-6 text-base font-semibold md:text-lg">Gerencie seus treinos com eficiência</p>
          </>
        }
        form={
          <div className="mx-auto w-full max-w-md">
            <h2 className="mb-2 text-center text-2xl font-bold text-slate-900 md:text-3xl">
              Bem-vindo de volta
            </h2>
            <p className="mb-8 text-center text-slate-600">
              Acesse sua conta para gerenciar seus treinos
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors({ ...errors, email: '' })
                }}
                error={errors.email}
                containerClassName="space-y-0"
              />
              <Input
                type="password"
                placeholder="Senha"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value)
                  if (errors.senha) setErrors({ ...errors, senha: '' })
                }}
                error={errors.senha}
                containerClassName="space-y-0"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="cursor-pointer text-sm font-medium text-primary transition-colors duration-200 hover:text-primary-hover"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Entrando...' : 'Entrar'}
                {!loading && <i className="fa-solid fa-arrow-right" />}
              </Button>
              <p className="text-center text-sm text-slate-600">
                Não tem uma conta?{' '}
                <Link to="/cadastro" className="font-medium text-primary hover:text-primary-hover">
                  Criar uma
                </Link>
              </p>
            </form>
          </div>
        }
      />

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} size="sm">
        <ModalHeader title="Redefinir senha" subtitle="Enviaremos um link para seu email." onClose={() => setIsModalOpen(false)} />
        <form onSubmit={handleResetPassword} className="space-y-4 p-6 pt-0">
          <Input
            type="email"
            placeholder="Digite seu email"
            value={resetEmail}
            onChange={(e) => {
              setResetEmail(e.target.value)
              if (resetErrors.resetEmail) setResetErrors({ ...resetErrors, resetEmail: '' })
            }}
            error={resetErrors.resetEmail}
            containerClassName="space-y-0"
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={resetLoading} className="flex-1">
              {resetLoading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
