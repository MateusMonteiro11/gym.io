import { supabase, setAuthStoragePreference } from '../../lib/supabase'
import { setRememberMe, setLastEmail, clearSessionPreferences, getRememberMe } from '../../utils/sessionStorage'
import { getUserFriendlyErrorMessage, logError } from '../../utils/errorMessages'

const LOGIN_ATTEMPTS_KEY = 'gym_io_login_attempts'
const LOGIN_LOCKOUT_KEY = 'gym_io_login_lockout_until'
const LOGIN_ATTEMPT_LIMIT = 5
const LOGIN_LOCKOUT_MS = 2 * 60 * 1000

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizarNome(nome) {
  return String(nome || '').trim().replace(/\s+/g, ' ')
}

function getLoginAttemptState() {
  if (typeof window === 'undefined') {
    return { attempts: 0, lockedUntil: 0 }
  }

  try {
    const attempts = Number(window.sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) || '0')
    const lockedUntil = Number(window.sessionStorage.getItem(LOGIN_LOCKOUT_KEY) || '0')

    return { attempts: Number.isFinite(attempts) ? attempts : 0, lockedUntil: Number.isFinite(lockedUntil) ? lockedUntil : 0 }
  } catch {
    return { attempts: 0, lockedUntil: 0 }
  }
}

function saveLoginAttemptState(attempts, lockedUntil) {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, String(attempts))
    window.sessionStorage.setItem(LOGIN_LOCKOUT_KEY, String(lockedUntil))
  } catch {
    // Ignore storage errors and keep the flow resilient.
  }
}

function clearLoginAttemptState() {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY)
    window.sessionStorage.removeItem(LOGIN_LOCKOUT_KEY)
  } catch {
    // Ignore storage errors and keep the flow resilient.
  }
}

function getPasswordResetRedirectUrl() {
  if (typeof window !== 'undefined') {
    return import.meta.env.VITE_SUPABASE_REDIRECT_URL || `${window.location.origin}/redefinir-senha`
  }

  return import.meta.env.VITE_SUPABASE_REDIRECT_URL || 'http://localhost:5173/redefinir-senha'
}

// Validação de force password

function validarForcaSenha(senha) {

  const temLetra = /[a-zA-Z]/.test(senha)
  const temNumero = /[0-9]/.test(senha)
  const temCaractereEspecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)
  const temComprimento = senha.length >= 6

  return {
    valida: temLetra && temNumero && temCaractereEspecial && temComprimento,
    temLetra,
    temNumero,
    temCaractereEspecial,
    temComprimento,
  }
}

// Login

export async function login(email, senha, rememberMe = false) {
  const previousRememberMe = getRememberMe()
  const normalizedEmail = normalizarEmail(email)
  const { attempts, lockedUntil } = getLoginAttemptState()

  if (lockedUntil > Date.now()) {
    const remainingSeconds = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000))
    throw new Error(`Muitas tentativas. Tente novamente em ${remainingSeconds} segundos.`)
  }

  setAuthStoragePreference(rememberMe)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: senha,
  })

  if (error) {
    const nextAttempts = attempts + 1
    const nextLockout = nextAttempts >= LOGIN_ATTEMPT_LIMIT ? Date.now() + LOGIN_LOCKOUT_MS : 0

    saveLoginAttemptState(nextAttempts, nextLockout)
    setAuthStoragePreference(previousRememberMe)
    const friendlyMessage = getUserFriendlyErrorMessage(error, 'Email ou senha inválidos.')
    logError(error, '[AuthService] Login failed')
    throw new Error(friendlyMessage)
  }

  clearLoginAttemptState()
  setRememberMe(rememberMe)
  setLastEmail(normalizedEmail)

  return data
}

// Cadastro

export async function cadastrar({
  nome,
  email,
  senha
}) {

  // Validar o force password

  const normalizedEmail = normalizarEmail(email)
  const normalizedNome = normalizarNome(nome)
  const validacao = validarForcaSenha(senha)

  if (!validacao.valida) {

    const requisitos = []
    
    if (!validacao.temComprimento) requisitos.push('Mínimo 6 caracteres')
    if (!validacao.temLetra) requisitos.push('Pelo menos uma letra')
    if (!validacao.temNumero) requisitos.push('Pelo menos um número')
    if (!validacao.temCaractereEspecial) requisitos.push('Pelo menos um caractere especial')

    throw new Error(
      `Senha fraca. Requisitos: ${requisitos.join(', ')}`
    )
  }

  // Autenticação supabase auth

  const { data, error } =
    await supabase.auth.signUp({

      email: normalizedEmail,
      password: senha,
      options: {
        data: {
          nome: normalizedNome,
        },
      },

    })

  if (error) {
    logError(error, '[AuthService] Cadastro failed')
    throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível criar sua conta.'))
  }

  const user = data?.user

  if (!user) {
    throw new Error(
      'Usuário não retornado pelo Supabase.'
    )
  }

  // Sign out the user after registration so they must log in explicitly
  await supabase.auth.signOut()

  return data
}

// Logout

export async function logout() {

  const { error } =
    await supabase.auth.signOut()

  if (error) {
    logError(error, '[AuthService] Logout failed')
    throw new Error(getUserFriendlyErrorMessage(error))
  }

  // Clear session preferences on logout
  clearSessionPreferences()
  setAuthStoragePreference(false)
}

// Resetar senha

export async function resetPassword(email) {

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: getPasswordResetRedirectUrl()
      }
    )

  if (error) {
    logError(error, '[AuthService] Reset password failed')
    throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível enviar o email de recuperação.'))
  }
}

// Usuario logado atualmente

export async function getUsuarioAtual() {

  const { data, error } =
    await supabase.auth.getUser()

  if (error) {
    logError(error, '[AuthService] Get user failed')
    throw new Error(getUserFriendlyErrorMessage(error))
  }

  return data.user
}
