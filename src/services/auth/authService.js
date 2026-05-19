import { supabase } from '../../lib/supabase'

/* =========================================================
   LOGIN
========================================================= */

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

/* =========================================================
   CADASTRO
========================================================= */

export async function cadastrar({
  nome,
  email,
  senha
}) {

  /*
  ─────────────────────────────────────────
  1. Criar autenticação no Supabase Auth
  ─────────────────────────────────────────
  */

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

  /*
  ─────────────────────────────────────────
  2. Inserir perfil na tabela usuarios
  ─────────────────────────────────────────
  Esta INSERT dispara automaticamente:
  - trigger PostgreSQL
  - clonagem dos treinos padrão
  ─────────────────────────────────────────
  */

  const { error: dbError } =
    await supabase
      .from('usuarios')
      .insert({

        id_usuario: user.id,

        nome,

        email,

      })

  /*
  ─────────────────────────────────────────
  3. Tratamento de erro do banco
  ─────────────────────────────────────────
  */

  if (dbError) {

    /*
    Tentativa opcional:
    remover usuário auth criado
    caso a tabela usuarios falhe
    */

    console.error(
      '[AuthService] Erro ao criar perfil:',
      dbError
    )

    throw new Error(dbError.message)
  }

  return data
}

/* =========================================================
   LOGOUT
========================================================= */

export async function logout() {

  const { error } =
    await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

/* =========================================================
   RESET DE SENHA
========================================================= */

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

/* =========================================================
   USUÁRIO ATUAL
========================================================= */

export async function getUsuarioAtual() {

  const { data, error } =
    await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  return data.user
}