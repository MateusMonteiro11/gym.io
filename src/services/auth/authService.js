import { supabase } from '../../lib/supabase'

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

export async function login(email, senha) {

  const { data, error } =
    await supabase.auth.signInWithPassword({

      email,
      password: senha,

    })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

// Cadastro

export async function cadastrar({
  nome,
  email,
  senha
}) {

  // Validar o force password

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

      email,
      password: senha,

    })

  if (error) {
    throw new Error(error.message)
  }

  const user = data?.user

  if (!user) {
    throw new Error(
      'Usuário não retornado pelo Supabase.'
    )
  }

  // Insere perfil no banco

  const { error: dbError } =
    await supabase
      .from('usuarios')
      .insert({

        id_usuario: user.id,

        nome,

        email,

      })

  // Trata erros no banco

  if (dbError) {

    // Remove usuário criado no auth para evitar inconsistências

    console.error(
      '[AuthService] Erro ao criar perfil:',
      dbError
    )

    throw new Error(dbError.message)
  }

  return data
}

// Logout

export async function logout() {

  const { error } =
    await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

// Resetar senha

export async function resetPassword(email) {

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          'http://localhost:5173/redefinir-senha'
      }
    )

  if (error) {
    throw new Error(error.message)
  }
}

// Usuario logado atualmente

export async function getUsuarioAtual() {

  const { data, error } =
    await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  return data.user
}