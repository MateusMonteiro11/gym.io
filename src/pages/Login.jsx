import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { login, resetPassword } from '../services/auth/authService'
import { supabase, setAuthStoragePreference } from '../lib/supabase'
import { getLastEmail } from '../utils/sessionStorage'
import { useUi } from '../contexts/UiContext'
import { useAuth } from '../hooks/useAuth'
import { getUserFriendlyErrorMessage } from '../utils/errorMessages'
import AuthShell from '../components/ui/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ModalHeader from '../components/ui/ModalHeader'
import ActionLoading from '../components/ui/ActionLoading'

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
  const { notify } = useUi()
  const { usuario, loading } = useAuth()
  const [email, setEmail] = useState(getLastEmail() || '')
  const [senha, setSenha] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [resetErrors, setResetErrors] = useState({})

  const redirectTarget = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search}${location.state.from.hash || ''}`
    : '/dashboard'

  useEffect(() => {
    if (!loading && usuario) navigate(redirectTarget, { replace: true })
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
      notify({ title: 'Erro ao entrar', message, type: 'error' })
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
      notify({ title: 'Email enviado', message: 'Verifique sua caixa de entrada para redefinir a senha.', type: 'success' })
      setIsModalOpen(false)
      setResetEmail('')
      setResetErrors({})
    } catch (error) {
      const message = error?.message || getUserFriendlyErrorMessage(error, 'Não foi possível enviar o email de recuperação.')
      notify({ title: 'Não foi possível enviar', message, type: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

    async function handleGoogleLogin() {
      try {
        setGoogleLoading(true)
        // Ensure Supabase uses the desired storage (localStorage vs sessionStorage)
        // before initiating the OAuth redirect so the session tokens are persisted
        setAuthStoragePreference(rememberMe)

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        })

        if (error) {
          console.error('Erro ao autenticar com Google:', error.message)
          notify({ title: 'Erro ao entrar', message: error.message, type: 'error' })
          setGoogleLoading(false)
        }
      } catch (err) {
        console.error('Erro inesperado no login com Google:', err)
        notify({
          title: 'Erro ao entrar',
          message: getUserFriendlyErrorMessage(err, 'Não foi possível entrar com o Google.'),
          type: 'error',
        })
        setGoogleLoading(false)
      }
    }

    return (
      <>
        <AuthShell
        brand={
          <>
            <h1 className="mt-0 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Volte para sua rotina.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/82 sm:text-lg">
              Entre para acompanhar seus treinos.
            </p>
          </>
        }
        form={
          <motion.div className="mx-auto w-full max-w-md" initial="hidden" animate="visible" variants={formMotion}>
            <motion.div variants={itemMotion} className="mb-8">
              <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">Acesse sua conta</h2>
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
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-primary/20 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border border-slate-300 text-primary transition-colors duration-200"
                  />
                  <span>Manter-me conectado</span>
                </label>
              </motion.div>

              <motion.div variants={itemMotion} className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary-muted hover:text-primary-hover"
                >
                  Esqueceu a senha?
                </button>
              </motion.div>

              <motion.div variants={itemMotion}>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? <ActionLoading label="Entrando..." inverse /> : 'Entrar'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </motion.div>

              <motion.div variants={itemMotion}>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading || googleLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary/20 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {googleLoading ? (
                    <ActionLoading label="Conectando..." />
                  ) : (
                    <>
                      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.652 32.657 29.359 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.079 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955c0-1.341-.138-2.651-.389-3.917z" />
                        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.967 12 24 12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.079 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                        <path fill="#4CAF50" d="M24 44c5.193 0 9.91-1.987 13.454-5.215l-6.21-5.243C29.197 35.091 26.761 36 24 36c-5.338 0-9.616-3.329-11.286-8.009l-6.522 5.025C9.499 39.556 16.227 44 24 44z" />
                        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.599 4.657-5.903 8-11.303 8-2.76 0-5.306-.995-7.286-2.652l-6.522 5.025C12.39 41.402 17.768 44 24 44c11.045 0 20-8.955 20-20 0-1.341-.138-2.651-.389-3.917z" />
                      </svg>
                      Entrar com Google
                    </>
                  )}
                </button>
              </motion.div>

              <motion.p variants={itemMotion} className="text-center text-sm text-slate-600 dark:text-slate-300">
                Não tem uma conta?{' '}
                <Link to="/cadastro" className="font-semibold text-primary hover:text-primary-hover">
                  Criar uma
                </Link>
              </motion.p>
            </motion.form>
          </motion.div>
        }
      />

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} size="sm">
        <ModalHeader title="Redefinir senha" subtitle="Enviaremos um link para seu email." onClose={() => setIsModalOpen(false)} />
        <form onSubmit={handleResetPassword} className="space-y-4 p-6">
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
              {resetLoading ? <ActionLoading label="Enviando..." inverse /> : 'Enviar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}