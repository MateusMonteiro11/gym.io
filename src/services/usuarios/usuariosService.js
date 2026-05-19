import { supabase } from '../../lib/supabase'

export async function atualizarUsuario(idUsuario, { nome, status, fotoPerfil }) {
  const updateData = {}

  if (nome !== undefined) updateData.nome = nome
  if (status !== undefined) updateData.status = status
  if (fotoPerfil !== undefined) updateData.foto_perfil = fotoPerfil

  if (Object.keys(updateData).length === 0) {
    return null
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(updateData)
    .eq('id_usuario', idUsuario)
    .select('id_usuario, nome, email, status, foto_perfil')

  if (error) {
    throw new Error(error.message)
  }

  return data?.[0] || null
}

export async function obterUsuario(idUsuario) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id_usuario, nome, email, status, foto_perfil, criado_em')
    .eq('id_usuario', idUsuario)

  if (error) {
    throw new Error(error.message)
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
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}
