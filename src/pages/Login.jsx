import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { login, resetPassword } from '../services/auth/authService'
import { getLastEmail } from '../utils/sessionStorage'
import { useUi } from '../contexts/UiContext'
import { useAuth } from '../hooks/useAuth'
import { getUserFriendlyErrorMessage } from '../utils/errorMessages'
import AuthField from '../features/auth/AuthField'
import SocialAuth from '../features/auth/SocialAuth'
import useGoogleAuth from '../features/auth/useGoogleAuth'
import { focusFirstError, useAuthDialogFocus } from '../features/auth/useAuthFeedback'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ModalHeader from '../components/ui/ModalHeader'
import ActionLoading from '../components/ui/ActionLoading'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useUi()
  const { usuario, loading } = useAuth()
  const [email, setEmail] = useState(getLastEmail() || '')
  const [senha, setSenha] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { googleLoading, startGoogleAuth } = useGoogleAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [resetErrors, setResetErrors] = useState({})

  const busy = isLoading || googleLoading
  useAuthDialogFocus(isModalOpen)

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
    focusFirstError(novoErros)
    return Object.keys(novoErros).length === 0
  }

  function validarResetEmail() {
    const novoErros = {}
    if (!resetEmail.trim()) novoErros.resetEmail = 'Digite seu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) novoErros.resetEmail = 'Email invalido'
    setResetErrors(novoErros)
    focusFirstError(novoErros)
    return Object.keys(novoErros).length === 0
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (busy || !validarFormulario()) return
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
    if (resetLoading || !validarResetEmail()) return
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

  return (
    <>
      <h2 id="auth-form-title" tabIndex={-1}>Bem vindo de volta</h2>
      <form onSubmit={handleLogin} noValidate aria-busy={busy}>
        <fieldset disabled={busy} className="m-0 grid min-w-0 gap-[1.1rem] border-0 border-none border-current p-0">
          <legend className="sr-only">Dados de acesso</legend>
          <SocialAuth loading={googleLoading} disabled={busy} onClick={() => startGoogleAuth(rememberMe)} />
          <AuthField id="email" label="E-mail" type="email" autoComplete="email" placeholder="seu@email.com"
            value={email} maxLength={254} autoCapitalize="none" autoCorrect="off" error={errors.email}
            onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: '' })) }} />
          <AuthField id="senha" label="Senha" type="password" autoComplete="current-password" placeholder="Sua senha"
            value={senha} maxLength={72} error={errors.senha}
            onChange={(event) => { setSenha(event.target.value); setErrors((current) => ({ ...current, senha: '' })) }} />
          <div className="auth-options">
            <label className="auth-check" htmlFor="rememberMe">
              <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span>Manter-me conectado</span>
            </label>
            <button type="button" className="auth-text-button" onClick={() => setIsModalOpen(true)}>Esqueceu a senha?</button>
          </div>
          <Button type="submit" disabled={busy} className="auth-submit" whileTap={undefined}>
            {isLoading ? <ActionLoading label="Entrando..." inverse /> : <>Entrar <ArrowRight size={16} aria-hidden /></>}
          </Button>
        </fieldset>
      </form>
      <p className="auth-switch">Ainda não possui uma conta? <Link to="/cadastro" state={location.state}>Criar conta</Link></p>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} size="sm" ariaLabel="Redefinir senha" className="auth-dialog">
        <ModalHeader title="Redefinir senha" subtitle="Enviaremos um link para seu email." onClose={() => setIsModalOpen(false)} />
        <form onSubmit={handleResetPassword} noValidate className="grid gap-6 p-6" aria-busy={resetLoading}>
          <AuthField id="resetEmail" label="E-mail" type="email" autoComplete="email" placeholder="seu@email.com"
            value={resetEmail} maxLength={254} autoCapitalize="none" autoCorrect="off" error={resetErrors.resetEmail}
            onChange={(event) => { setResetEmail(event.target.value); setResetErrors({}) }} />
          <div className="auth-dialog-actions flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} whileTap={undefined}>Cancelar</Button>
            <Button type="submit" disabled={resetLoading} className="auth-submit" whileTap={undefined}>
              {resetLoading ? <ActionLoading label="Enviando..." inverse /> : 'Enviar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
