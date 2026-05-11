import { supabase } from '../../lib/supabase'

export async function login(email, senha) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password: senha
    })

  if (error) throw error

  return data
}

export async function cadastrar({
  nome,
  email,
  senha
}) {

  // cria autenticação
  const { data, error } =
    await supabase.auth.signUp({
      email,
      password: senha
    })

  if (error) throw error

  // salva dados extras na tabela usuarios
  const user = data.user

  if (user) {
    const { error: dbError } =
      await supabase
        .from('usuarios')
        .insert({
          id_usuario: user.id,
          nome,
          email
        })

    if (dbError) throw dbError
  }

  return data
}

export async function logout() {
  await supabase.auth.signOut()
}

export async function resetPassword(email) {

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          'http://localhost:5173/redefinir-senha'
      }
    )

  if (error) throw error
}

export async function getUsuarioAtual() {
  const { data } =
    await supabase.auth.getUser()

  return data.user
}