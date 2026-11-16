import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import logoImg from '../assets/images/logo_blue.png'
import { useAuth } from '../hooks/useAuth'
import { obterUsuario } from '../services/usuarios/usuariosService'
import { logout } from '../services/auth/authService'
import { useUi } from '../contexts/UiContext'
import ProfileAvatar from './ProfileAvatar'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import UserProfileModal from './UserProfileModal'
import ThemeToggle from './ui/ThemeToggle'
import { Skeleton } from './ui/Skeleton'
import ActionLoading from './ui/ActionLoading'

const navItems = [
  { to: '/dashboard', icon: 'fa-solid fa-grip', label: 'Painel' },
  { to: '/treinos', icon: 'fa-solid fa-dumbbell', label: 'Treinos' },
  { to: '/treinar', icon: 'fa-solid fa-play', label: 'Treinar' },
  { to: '/historico', icon: 'fa-solid fa-clock-rotate-left', label: 'Histórico' },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const { alert, notify } = useUi()
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [userData, setUserData] = useState(null)
  const [loadedUserId, setLoadedUserId] = useState(null)
  const [loadingUserData, setLoadingUserData] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isOnTrainingPage = pathname.startsWith('/treinar/')
  const hasActiveTraining = isOnTrainingPage
  const isUserLoading = authLoading || loadingUserData || (
    Boolean(usuario?.id) && loadedUserId !== usuario.id
  )

  useEffect(() => {
    let active = true

    if (!usuario?.id) {
      setUserData(null)
      setLoadedUserId(null)
      setLoadingUserData(false)
      return undefined
    }

    const carregarDadosUsuario = async () => {
      try {
        setLoadingUserData(true)
        const dados = await obterUsuario(usuario.id)
        if (active) {
          setUserData(dados)
          setLoadedUserId(usuario.id)
        }
      } catch (err) {
        if (active) {
          console.error('Erro ao carregar dados do usuário:', err)
          setUserData(null)
          setLoadedUserId(usuario.id)
        }
      } finally {
        if (active) setLoadingUserData(false)
      }
    }

    carregarDadosUsuario()

    return () => {
      active = false
    }
  }, [usuario?.id])

  const handleModalClose = () => {
    setProfileModalOpen(false)
  }

  const handleProfileUpdate = async () => {
    if (!usuario?.id) return
    try {
      const dados = await obterUsuario(usuario.id)
      setUserData(dados)
      setLoadedUserId(usuario.id)
    } catch (err) {
      console.error('Erro ao atualizar dados do usuário:', err)
    }
    setProfileModalOpen(false)
  }

  const handleLogoutConfirm = async () => {
    try {
      setLoggingOut(true)
      const result = await logout()
      if (result?.warnings?.length) {
        notify({ title: 'Conta desconectada', message: 'A limpeza das notificações foi parcial. Algum vínculo pode continuar no navegador ou backend; a contenção local foi tentada.', type: 'warning', duration: 0 })
      }
      navigate('/login')
    } catch (err) {
      console.error('Erro ao sair:', err)
    } finally {
      setLoggingOut(false)
      setLogoutModalOpen(false)
    }
  }

  const handleCancelLogout = () => {
    setLogoutModalOpen(false)
  }

  const handleNavigation = (to) => {
    if (hasActiveTraining) {
      alert({
        title: 'Treino em andamento',
        message: 'Você não pode navegar enquanto um treino está ativo. Finalize o treino primeiro ou cancele seu treino.',
        type: 'warning',
      })
    } else {
      navigate(to)
      setSidebarOpen(false)
    }
  }

  const handleLogoutClick = () => {
    if (hasActiveTraining) {
      alert({
        title: 'Treino em andamento',
        message: 'Você não pode sair enquanto um treino está ativo. Finalize o treino primeiro ou cancele seu treino.',
        type: 'warning',
      })
    } else {
      setLogoutModalOpen(true)
    }
  }

  const handleLogoClick = () => {
    if (hasActiveTraining) {
      alert({
        title: 'Treino em andamento',
        message: 'Você não pode navegar enquanto um treino está ativo. Finalize o treino primeiro ou cancele seu treino.',
        type: 'warning',
      })
    } else {
      navigate('/dashboard')
      setSidebarOpen(false)
    }
  }

  return (
    <>
      {/* Mobile Header com Hamburger Button */}
      <div className="flex md:hidden w-full items-center justify-between border-b border-app-line/80 bg-app-surface p-5">
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
          title="Voltar ao dashboard"
        >
          <img
            src={logoImg}
            className="h-11 w-11 rounded-xl shadow-sm ring-1 ring-app-line"
            alt="Logo Gym.io"
          />
          <h1 className="text-lg font-semibold tracking-tight text-app-ink">Gym.io</h1>
        </button>
        <div className="flex items-center gap-2">
          <ThemeToggle compact className="h-10 px-3" />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-app-line text-app-secondary transition-colors hover:bg-app-muted hover:text-app-ink"
            aria-label="Toggle sidebar"
          >
            <i className={`fa-solid fa-${sidebarOpen ? 'times' : 'bars'} text-xl`} />
          </button>
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-app-overlay md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 flex w-72 flex-col justify-between border-b border-app-line/80 bg-app-surface p-5 md:border-b-0 md:border-r md:p-6 transition-transform duration-300 ease-in-out md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } md:w-72 md:border-b-0 md:border-r md:p-6 md:relative`}>
        <div>
          {/* Logo*/}
          <div className="mb-8 flex items-center gap-3 hidden md:flex">
            <img
              src={logoImg}
              className="h-11 w-11 rounded-xl shadow-sm ring-1 ring-app-line"
              alt="Logo Gym.io"
            />
            <h1 className="text-lg font-semibold tracking-tight text-app-ink">Gym.io</h1>
          </div>

          <nav className="space-y-1">
            {navItems.map(({ to, icon, label }) => {
              const isActive = pathname === to
              return (
                <button
                  key={to}
                  onClick={() => handleNavigation(to)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-app-selection text-app-accent'
                      : 'text-app-secondary hover:bg-app-muted hover:text-app-ink'
                  }`}
                >
                  <i className={`${icon} w-5 text-center`} />
                  {label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="mt-8 border-t border-app-line pt-5">
          <button
            type="button"
            aria-label="Abrir meu perfil"
            onClick={() => setProfileModalOpen(true)}
            className="mb-4 w-full flex items-center gap-3 rounded-lg transition-colors duration-200 hover:bg-app-muted p-2 -ml-2"
          >
            {isUserLoading ? (
              <div className="h-10 w-10 shrink-0">
                <Skeleton className="h-full w-full rounded-full" />
              </div>
            ) : <ProfileAvatar photo={userData?.foto_perfil} user={usuario} name={userData?.nome} className="h-10 w-10 text-sm" />}
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold text-app-ink">
                {isUserLoading ? (
                  <Skeleton className="h-3 w-24 rounded-full" />
                ) : (
                  userData?.nome || usuario?.email?.split('@')[0] || 'Usuário'
                )}
              </p>
              {isUserLoading ? (
                <Skeleton className="mt-2 h-2.5 w-32 rounded-full" />
              ) : (
                <p className="truncate text-xs text-app-secondary">{usuario?.email || ''}</p>
              )}
            </div>
            <i className="fa-solid fa-chevron-right text-app-secondary text-xs flex-shrink-0" />
          </button>
          <ThemeToggle className="mb-4 w-full justify-center" />
          <button
            type="button"
            onClick={handleLogoutClick}
            className="flex w-full items-center gap-2 text-sm text-app-secondary transition-colors duration-200 hover:text-app-danger"
          >
            <i className="fa-solid fa-right-from-bracket w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Modals render */}
      <UserProfileModal
        open={profileModalOpen}
        onClose={handleModalClose}
        onUpdate={handleProfileUpdate}
      />

      <Modal
        open={logoutModalOpen}
        onClose={handleCancelLogout}
        size="sm"
      >
        <ModalHeader
          title="Confirmar saída"
          subtitle="Tem certeza de que deseja sair do Gym.io?"
          onClose={handleCancelLogout}
        />
        <div className="px-6 py-5">
          <p className="text-sm text-app-secondary">
            Ao confirmar, você será desconectado do sistema e retornará para a tela de login.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancelLogout}
              className="inline-flex justify-center rounded-lg border border-app-line bg-app-muted px-4 py-2 text-sm font-medium text-app-ink transition-colors duration-200 hover:bg-app-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleLogoutConfirm}
              disabled={loggingOut}
              className="inline-flex justify-center rounded-lg bg-app-neutral-action px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-app-neutral-action dark:bg-app-danger-action dark:enabled:hover:bg-app-danger-hover dark:enabled:active:bg-[color-mix(in_srgb,var(--app-danger-hover)_85%,var(--app-surface))] dark:focus-visible:outline-none dark:focus-visible:ring-2 dark:focus-visible:ring-app-danger dark:focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? <ActionLoading label="Saindo..." inverse /> : 'Confirmar saída'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
