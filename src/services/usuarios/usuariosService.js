import { supabase } from '../../lib/supabase'
import { getUserFriendlyErrorMessage, logError } from '../../utils/errorMessages'

export async function atualizarUsuario(idUsuario, { nome, status, fotoPerfil }) {
  const updateData = {}

  if (nome !== undefined) updateData.nome = nome
  if (status !== undefined) updateData.status = status
  if (fotoPerfil !== undefined) updateData.foto_perfil = fotoPerfil

  if (Object.keys(updateData).length === 0) {
    return null
  }

  // Try to update existing user first
  const { data, error } = await supabase
    .from('usuarios')
    .update(updateData)
    .eq('id_usuario', idUsuario)
    .select('id_usuario, nome, email, status, foto_perfil')

  if (error) {
    throw new Error(error.message)
  }

  // If no rows were updated, attempt to insert a new user record
  if (!data || data.length === 0) {
    const insertData = { id_usuario: idUsuario, ...updateData }
    const { data: insertedData, error: insertError } = await supabase
      .from('usuarios')
      .insert(insertData)
      .select('id_usuario, nome, email, status, foto_perfil')

    if (insertError) {
      throw new Error(insertError.message)
    }

    return insertedData?.[0] || null
  }

  return data?.[0] || null
}

export async function obterUsuario(idUsuario) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id_usuario, nome, email, status, foto_perfil, criado_em')
    .eq('id_usuario', idUsuario)

  if (error) {
    logError(error, '[UsuariosService] Failed to load user')
    throw new Error(getUserFriendlyErrorMessage(error, 'Não foi possível carregar os dados do usuário.'))
  }

  return data?.[0] || null
}

export async function uploadFotoPerfil(idUsuario, file) {
  if (!file) {
    throw new Error('Nenhum arquivo selecionado')
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const fotoPerfil = event.target?.result
        await atualizarUsuario(idUsuario, { fotoPerfil })
        resolve(fotoPerfil)
      } catch (err) {
        logError(err, '[UsuariosService] Failed to upload profile image')
        reject(new Error(getUserFriendlyErrorMessage(err, 'Não foi possível enviar a foto de perfil.')))
      }
    }
    reader.onerror = () => reject(new Error(getUserFriendlyErrorMessage(new Error('Erro ao ler arquivo'), 'Não foi possível ler a imagem.')))
    reader.readAsDataURL(file)
  })
}
