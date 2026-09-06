const PUBLIC_TOP_ROUTES = new Set(['/', '/login', '/cadastro'])
const AUTH_ROUTES = new Set(['/login', '/cadastro'])

const AUTHENTICATED_ROUTE_PREFIXES = [
  '/dashboard',
  '/treinos',
  '/treinar',
  '/historico',
]

export function shouldResetRouteScroll({ pathname, hash = '', previousPathname = null }) {
  if (hash) return false
  if (AUTH_ROUTES.has(previousPathname) && AUTH_ROUTES.has(pathname)) return false

  return PUBLIC_TOP_ROUTES.has(pathname)
    || AUTHENTICATED_ROUTE_PREFIXES.some((routePrefix) => (
      pathname === routePrefix || pathname.startsWith(`${routePrefix}/`)
    ))
}
