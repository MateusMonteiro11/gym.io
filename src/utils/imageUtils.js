const MAX_PROFILE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024
const ACCEPTED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPTED_PROFILE_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

export function validateProfileImageFile(file) {
  if (!file) {
    return { valid: false, message: 'Nenhum arquivo selecionado.' }
  }

  const extension = (file.name || '').split('.').pop()?.toLowerCase() || ''
  const mimeType = (file.type || '').toLowerCase()

  if (mimeType === 'image/svg+xml' || extension === 'svg') {
    return { valid: false, message: 'Arquivos SVG não são permitidos.' }
  }

  const hasAllowedMime = ACCEPTED_PROFILE_IMAGE_TYPES.includes(mimeType)
  const hasAllowedExtension = ACCEPTED_PROFILE_IMAGE_EXTENSIONS.includes(extension)

  if (!hasAllowedMime && !hasAllowedExtension) {
    return { valid: false, message: 'Apenas imagens JPEG, PNG ou WebP são permitidas.' }
  }

  if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
    return { valid: false, message: 'A imagem deve ter no máximo 2 MB.' }
  }

  return { valid: true }
}

export function isSafeRenderableImageUrl(src) {
  if (typeof src !== 'string') {
    return false
  }

  const value = src.trim()

  if (!value) {
    return false
  }

  const normalized = value.toLowerCase()

  if (normalized.startsWith('javascript:') || normalized.includes('<') || normalized.includes('>')) {
    return false
  }

  if (normalized.startsWith('blob:')) {
    return false
  }

  return normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('/')
    || normalized.startsWith('./')
    || normalized.startsWith('../')
    || normalized.startsWith('data:image/')
}
