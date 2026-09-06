import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cadastrar } from '../services/auth/authService'
import { useUi } from '../contexts/UiContext'
import { getUserFriendlyErrorMessage, logError } from '../utils/errorMessages'
import AuthField from '../features/auth/AuthField'
import SocialAuth from '../features/auth/SocialAuth'
import useGoogleAuth from '../features/auth/useGoogleAuth'
import { focusFirstError, useAuthDialogFocus } from '../features/auth/useAuthFeedback'
import Button from '../components/ui/Button'
import TermsAndPrivacyModal from '../components/TermsAndPrivacyModal'
import ActionLoading from '../components/ui/ActionLoading'

export default function Cadastro() {
  const navigate = useNavigate()
  const location = useLocation()
  const { googleLoading, startGoogleAuth } = useGoogleAuth()
  const { notify } = useUi()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [termsShakeKey, setTermsShakeKey] = useState(0)
  const [termos, setTermos] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [initialLegalDocument, setInitialLegalDocument] = useState('terms')

  const busy = loading || googleLoading
  useAuthDialogFocus(termsModalOpen)

  function openLegalDocument(documentId) {
    setInitialLegalDocument(documentId)
    setTermsModalOpen(true)
  }

  function validarForcaSenha(senhaTemp) {
    const temLetra = /[a-zA-Z]/.test(senhaTemp)
    const temNumero = /[0-9]/.test(senhaTemp)
    const temCaractereEspecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senhaTemp)
    const temComprimento = senhaTemp.length >= 6

    return {
      valida: temLetra && temNumero && temCaractereEspecial && temComprimento,
      temLetra,
      temNumero,
      temCaractereEspecial,
      temComprimento,
    }
  }

  function validarFormulario() {
    const novoErros = {}
    if (!nome.trim()) novoErros.nome = 'Seu nome é obrigatório'
    if (!email.trim()) novoErros.email = 'Seu email é obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) novoErros.email = 'Email inválido'
    if (!senha) {
      novoErros.senha = 'Senha é obrigatória'
    } else {
      const validacao = validarForcaSenha(senha)
      if (!validacao.valida) {
        const requisitos = []
        if (!validacao.temComprimento) requisitos.push('mínimo 6 caracteres')
        if (!validacao.temLetra) requisitos.push('uma letra')
        if (!validacao.temNumero) requisitos.push('um número')
        if (!validacao.temCaractereEspecial) requisitos.push('um caractere especial')
        novoErros.senha = `Faltam: ${requisitos.join(', ')}`
      }
    }
    if (!confirmarSenha) novoErros.confirmarSenha = 'Confirmação de senha é obrigatória'
    else if (senha !== confirmarSenha) novoErros.confirmarSenha = 'As senhas não coincidem'
    if (!termos) {
      novoErros.termos = 'Você deve concordar com os termos'
      setTermsShakeKey((current) => current + 1)
    }
    setErrors(novoErros)
    focusFirstError(novoErros)
    return Object.keys(novoErros).length === 0
  }

  async function handleCadastro(e) {
    e.preventDefault()
    if (busy || !validarFormulario()) return
    try {
      setLoading(true)
      await cadastrar({ nome, email, senha })
      notify({ title: 'Conta criada', message: 'Faça login para continuar.', type: 'success' })
      navigate('/login', { state: location.state })
    } catch (error) {
      const message = getUserFriendlyErrorMessage(error, 'Não foi possível criar sua conta.')
      logError(error, '[Cadastro] Failed to sign up')
      notify({ title: 'Erro no cadastro', message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const senhaValida = validarForcaSenha(senha)

  return (
    <>
      <h2 id="auth-form-title" tabIndex={-1}>Criar sua conta</h2>
      <form onSubmit={handleCadastro} noValidate aria-busy={busy}>
        <fieldset disabled={busy} className="auth-fields">
          <legend className="sr-only">Dados para criar sua conta</legend>
          <SocialAuth loading={googleLoading} disabled={busy} onClick={() => startGoogleAuth(false)} />
          <AuthField id="nome" label="Nome" type="text" autoComplete="name" placeholder="Seu nome completo"
            value={nome} maxLength={80} error={errors.nome}
            onChange={(event) => { setNome(event.target.value); setErrors((current) => ({ ...current, nome: '' })) }} />
          <AuthField id="email" label="E-mail" type="email" autoComplete="email" placeholder="seu@email.com"
            value={email} maxLength={254} autoCapitalize="none" autoCorrect="off" error={errors.email}
            onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: '' })) }} />
          <div>
            <AuthField id="senha" label="Senha" type="password" autoComplete="new-password" placeholder="Crie sua senha"
              value={senha} maxLength={72} error={errors.senha} aria-describedby="password-guidance"
              onChange={(event) => { setSenha(event.target.value); setErrors((current) => ({ ...current, senha: '' })) }} />
            <p id="password-guidance" className="auth-guidance">Use pelo menos 6 caracteres, uma letra, um número e um caractere especial.</p>
            {senha && <p className="auth-strength" role="status">
              <span className={`auth-strength-track ${senhaValida.valida ? 'is-valid' : senha.length >= 4 ? 'is-medium' : ''}`} aria-hidden><i /></span>
              {senhaValida.valida ? '✓ Segura' : senha.length >= 4 ? '◐ Média' : '○ Fraca'}
            </p>}
          </div>
          <AuthField id="confirmarSenha" label="Confirmar senha" type="password" autoComplete="new-password" placeholder="Repita sua senha"
            value={confirmarSenha} maxLength={72} error={errors.confirmarSenha}
            onChange={(event) => { setConfirmarSenha(event.target.value); setErrors((current) => ({ ...current, confirmarSenha: '' })) }} />
          <div>
            <div key={termsShakeKey} className={`auth-terms-row${errors.termos ? ' auth-terms-shake' : ''}`}>
              <label className="auth-checkbox-target" htmlFor="termos">
              <input type="checkbox" id="termos" checked={termos} aria-labelledby="terms-copy" aria-invalid={Boolean(errors.termos)}
                onChange={(event) => { setTermos(event.target.checked); setErrors((current) => ({ ...current, termos: '' })) }} />
              </label>
              <div id="terms-copy"><label htmlFor="termos">Concordo com os </label>
                <button type="button" className="auth-legal-link" onClick={() => openLegalDocument('terms')}>Termos de Uso</button>
                <span> e a </span>
                <button type="button" className="auth-legal-link" onClick={() => openLegalDocument('privacy')}>Política de Privacidade</button>.
              </div>
            </div>
          </div>
          <Button type="submit" disabled={busy} className="auth-submit" whileTap={undefined}>
            {loading ? <ActionLoading label="Criando conta..." inverse /> : <>Criar conta <ArrowRight size={16} aria-hidden /></>}
          </Button>
        </fieldset>
      </form>
      <p className="auth-switch">Já possui uma conta? <Link to="/login" state={location.state}>Entrar</Link></p>
      <TermsAndPrivacyModal open={termsModalOpen} onClose={() => setTermsModalOpen(false)} initialDocument={initialLegalDocument} />
    </>
  )
}
