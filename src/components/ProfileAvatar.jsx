import { useState } from 'react'
import { isSafeRenderableImageUrl } from '../utils/imageUtils'

export default function ProfileAvatar({ photo, user, name, onView, buttonRef, className = '' }) {
  const [failedSources, setFailedSources] = useState([])
  const candidates = [photo, user?.user_metadata?.avatar_url, user?.user_metadata?.picture]
    .filter(isSafeRenderableImageUrl).map((source) => source.trim())
  const source = candidates.find((candidate) => !failedSources.includes(candidate))
  const displayName = name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'
  const initial = (displayName.trim()[0] || 'U').toUpperCase()
  const canView = Boolean(source && onView)
  const Container = canView ? 'button' : 'div'

  return (
    <Container
      ref={buttonRef}
      type={canView ? 'button' : undefined}
      aria-label={canView ? `Visualizar foto de perfil de ${displayName}` : undefined}
      title={canView ? 'Visualizar foto de perfil' : undefined}
      onClick={canView ? () => onView(source) : undefined}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-app-selection font-semibold text-app-accent ${canView ? 'cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-surface' : ''} ${className}`}
    >
      {source ? <img
        src={source}
        alt={`Foto de perfil de ${displayName}`}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => setFailedSources((previous) => [...previous, source])}
      /> : initial}
    </Container>
  )
}
