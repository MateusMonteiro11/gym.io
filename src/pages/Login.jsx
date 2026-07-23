import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import logoImg from '../assets/images/logo.png'
import { login, resetPassword } from '../services/auth/authService'
import { getLastEmail } from '../utils/sessionStorage'
import { useUi } from '../contexts/UiContext'
import { useAuth } from '../hooks/useAuth'
import { getUserFriendlyErrorMessage } from '../utils/errorMessages'
import AuthShell from '../components/ui/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ModalHeader from '../components/ui/ModalHeader'

const formMotion = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut', staggerChildren: 0.06 },
  },
}

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { alert, notify } = useUi()
  const { usuario, loading } = useAuth()
  const [email, setEmail] = useState(getLastEmail() || '')
  const [senha, setSenha] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [resetErrors, setResetErrors] = useState({})

  const redirectTarget = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search}${location.state.from.hash || ''}`
    : '/dashboard'

  useEffect(() => {
    if (!loading && usuario) {
      navigate(redirectTarget, { replace: true })
    }
  }, [loading, navigate, redirectTarget, usuario])

  function validarFormulario() {
    const novoErros = {}

    if (!email.trim()) novoErros.email = 'Digite seu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) novoErros.email = 'Email invalido'

    if (!senha) novoErros.senha = 'Digite sua senha'

    setErrors(novoErros)
    return Object.keys(novoErros).length === 0
  }

  function validarResetEmail() {
    const novoErros = {}

    if (!resetEmail.trim()) novoErros.resetEmail = 'Digite seu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) novoErros.resetEmail = 'Email invalido'

    setResetErrors(novoErros)
    return Object.keys(novoErros).length === 0
  }

  async function handleLogin(e) {
    e.preventDefault()

    if (!validarFormulario()) return

    try {
      setIsLoading(true)
      await login(email, senha, rememberMe)
      navigate(redirectTarget)
    } catch (error) {
      const message = error?.message || getUserFriendlyErrorMessage(error, 'Não foi possível entrar.')
      alert({ title: 'Erro ao entrar', message, type: 'error' })
    } finally {
      setIsLoading(false)
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
      const message = error?.message || getUserFriendlyErrorMessage(error, 'Não foi possível enviar o email de recuperação.')
      alert({ title: 'Erro', message, type: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <>
      <AuthShell
        brand={
          <>
            <motion.img
              src={logoImg}
              alt="GYM.IO"
              className="mx-auto mb-6 w-20 drop-shadow-xl sm:w-28 md:mb-8 md:w-48"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-4xl">Bem-vindo de volta</h1>
            <p className="mx-auto mb-5 max-w-sm text-base font-medium leading-7 text-white/80 md:mb-6 md:text-lg">
              Continue organizando treinos, sessões e progresso em um workspace simples com:
            </p>
            <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
              {['Treinos', 'Histórico', 'Agendamentos'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/30 bg-white/10 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </>
        }
        form={
          <motion.div className="mx-auto w-full max-w-md" initial="hidden" animate="visible" variants={formMotion}>
            <motion.div variants={itemMotion} className="mb-8 text-center">
              <span className="mb-4 inline-flex rounded-full border border-blue-100 bg-primary-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Login
              </span>
              <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                Acesse sua conta
              </h2>
              <p className="text-slate-600">
                Acesse sua conta para gerenciar seus treinos
              </p>
            </motion.div>

            <motion.form onSubmit={handleLogin} className="space-y-4" variants={formMotion}>
              <motion.div variants={itemMotion}>
                <Input
                  type="text"
                  placeholder="Email"
                  value={email}
                  maxLength={254}
                  autoCapitalize="none"
                  autoCorrect="off"
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors({ ...errors, email: '' })
                  }}
                  error={errors.email}
                  containerClassName="space-y-0"
                />
              </motion.div>

              <motion.div variants={itemMotion}>
                <Input
                  type="password"
                  placeholder="Senha"
                  value={senha}
                  maxLength={72}
                  onChange={(e) => {
                    setSenha(e.target.value)
                    if (errors.senha) setErrors({ ...errors, senha: '' })
                  }}
                  error={errors.senha}
                  containerClassName="space-y-0"
                />
              </motion.div>

              <motion.div variants={itemMotion}>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/5">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border border-slate-300 transition-colors duration-200 text-primary cursor-pointer"
                  />
                  <span>Manter-me conectado</span>
                </label>
              </motion.div>

              <motion.div variants={itemMotion} className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="cursor-pointer rounded-lg px-2 py-1 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary-muted hover:text-primary-hover"
                >
                  Esqueceu a senha?
                </button>
              </motion.div>

              <motion.div variants={itemMotion}>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Entrando...' : 'Entrar'}
                  {!isLoading && <i className="fa-solid fa-arrow-right" />}
                </Button>
              </motion.div>

              <motion.p variants={itemMotion} className="text-center text-sm text-slate-600">
                Nao tem uma conta?{' '}
                <Link to="/cadastro" className="font-medium text-primary hover:text-primary-hover">
                  Criar uma
                </Link>
              </motion.p>
            </motion.form>
          </motion.div>
        }
      />

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} size="sm">
        <ModalHeader title="Redefinir senha" subtitle="Enviaremos um link para seu email." onClose={() => setIsModalOpen(false)} />
        <form onSubmit={handleResetPassword} className="space-y-4 p-6 pt-0">
          <Input
            type="text"
            placeholder="Digite seu email"
            value={resetEmail}
            maxLength={254}
            autoCapitalize="none"
            autoCorrect="off"
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
