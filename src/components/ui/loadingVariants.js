export function resolveLoadingVariant(pathname = '') {
  if (pathname === '/dashboard') return 'dashboard'
  if (pathname === '/treinos') return 'workouts'
  if (pathname === '/treinos/editar') return 'editor-new'
  if (pathname.startsWith('/treinos/editar/')) return 'editor'
  if (pathname.startsWith('/treinos/visualizar')) return 'details'
  if (pathname === '/treinar') return 'training'
  if (pathname.startsWith('/treinar/')) return 'player'
  if (pathname === '/historico') return 'history'
  return 'dashboard'
}
