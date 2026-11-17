export const navigationItems = [
  { to: '/dashboard', icon: 'fa-solid fa-grip', label: 'Painel', mobileLabel: 'Início' },
  { to: '/treinos', icon: 'fa-solid fa-dumbbell', label: 'Treinos', mobileLabel: 'Treinos' },
  { to: '/treinar', icon: 'fa-solid fa-play', label: 'Treinar', mobileLabel: 'Treinar' },
  { to: '/historico', icon: 'fa-solid fa-clock-rotate-left', label: 'Histórico', mobileLabel: 'Histórico' },
]

export function isNavigationItemActive(pathname, destination) {
  return pathname === destination || pathname.startsWith(`${destination}/`)
}
