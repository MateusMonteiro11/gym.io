import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useUi } from '../contexts/UiContext'
import { atualizarUsuario, uploadFotoPerfil, obterUsuario } from '../services/usuarios/usuariosService'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import Button from './ui/Button'
import Input, { Label } from './ui/Input'
import { getUserFriendlyErrorMessage, logError } from '../utils/errorMessages'
import { validateProfileImageFile } from '../utils/imageUtils'
import { Skeleton } from './ui/Skeleton'
import ActionLoading from './ui/ActionLoading'
import PushNotificationSettings from './PushNotificationSettings'
import ProfileWeeklyStats from '../features/history/ProfileWeeklyStats.jsx'

export default function UserProfileModal({ open, onClose, onUpdate }) {
  const { usuario } = useAuth()
  const { alert, notify } = useUi()

  const [activeTab, setActiveTab] = useState('profile')
  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('')
  const [fotoPreview, setFotoPreview] = useState(null)
  const [fotoFile, setFotoFile] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [carregandoUsuario, setCarregandoUsuario] = useState(false)

  useEffect(() => {
    let active = true

    if (!open || !usuario?.id) {
      setCarregandoUsuario(false)
      return undefined
    }

    const carregarDadosUsuario = async () => {
      try {
        setCarregandoUsuario(true)
        const usuarioDB = await obterUsuario(usuario.id)
        if (!active) return

        setNome(usuarioDB?.nome || usuario.email?.split('@')[0] || '')
        setStatus(usuarioDB?.status || '')
        setFotoPreview(usuarioDB?.foto_perfil || null)
        setFotoFile(null)
      } catch (err) {
        if (!active) return

        logError(err, '[UserProfileModal] Failed to load user data')
        setNome(usuario.email?.split('@')[0] || '')
        setStatus('')
        setFotoPreview(null)
      } finally {
        if (active) setCarregandoUsuario(false)
      }
    }

    carregarDadosUsuario()

    return () => {
      active = false
    }
  }, [open, usuario?.email, usuario?.id])

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateProfileImageFile(file)

    if (!validation.valid) {
      alert({
        title: 'Imagem inválida',
        message: validation.message,
        type: 'error',
      })
      e.target.value = ''
      return
    }

    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setFotoPreview(event.target?.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSalvar = async () => {
    if (!usuario?.id) return

    try {
      setSalvando(true)

      let fotoPerfil = fotoPreview

      if (fotoFile) {
        fotoPerfil = await uploadFotoPerfil(usuario.id, fotoFile)
      }

      await atualizarUsuario(usuario.id, {
        nome: nome || undefined,
        status: status || undefined,
        fotoPerfil: fotoPerfil || undefined,
      })

      notify({
        title: 'Perfil atualizado',
        message: 'Suas informações foram salvas com sucesso.',
        type: 'success',
      })

      onUpdate?.()
      onClose?.()
    } catch (err) {
      const message = getUserFriendlyErrorMessage(err, 'Não foi possível salvar o perfil.')
      logError(err, '[UserProfileModal] Failed to save profile')
      notify({
        title: 'Erro ao salvar',
        message,
        type: 'error',
      })
    } finally {
      setSalvando(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: 'fa-user' },
    { id: 'stats', label: 'Estatísticas', icon: 'fa-chart-bar' },
    { id: 'notifications', label: 'Notificações', icon: 'fa-bell' },
  ]

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader title="Meu Perfil" onClose={onClose} />

      <div className="flex border-b border-app-line" role="group" aria-label="Seções do perfil">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2 flex-1 min-w-0 px-2 sm:px-4 py-4 text-xs sm:text-sm font-medium transition-colors duration-200 border-b-2 ${
              activeTab === tab.id
                ? 'border-app-accent text-app-accent'
                : 'border-transparent text-app-secondary hover:text-app-ink'
            }`}
          >
            <i className={`fa-solid ${tab.icon} text-base`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'notifications' && <PushNotificationSettings />}
        {/* Profile */}
        {activeTab === 'profile' && (carregandoUsuario ? (
          <div className="space-y-6" role="status" aria-label="Carregando perfil...">
            <Skeleton className="mx-auto h-24 w-24 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <Skeleton className="ml-auto h-11 w-1/2 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="mb-4">
                <div className="h-24 w-24 rounded-full bg-app-selection flex items-center justify-center text-4xl text-app-accent overflow-hidden">
                  {fotoPreview ? (
                    <img
                      src={fotoPreview}
                      alt="Foto"
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                        event.currentTarget.parentElement?.classList?.add('bg-app-muted')
                      }}
                    />
                  ) : (
                    usuario?.email?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="hidden"
                  disabled={salvando}
                />
                <span className={`inline-flex items-center gap-2 text-sm text-app-accent font-medium hover:text-app-action-hover transition-colors ${salvando ? 'opacity-50' : ''}`}>
                  <i className="fa-solid fa-camera" />
                  Alterar foto
                </span>
              </label>
            </div>

            <div>
              <Label htmlFor="nome">
                <i className="fa-solid fa-user mr-2" />
                Nome
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                disabled={salvando}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="status">
                <i className="fa-solid fa-message mr-2" />
                Status
              </Label>
              <Input
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="Qual é seu objetivo?"
                disabled={salvando}
                className="mt-2"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={onClose} disabled={salvando}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSalvar} disabled={salvando}>
                {salvando ? (
                  <ActionLoading label="Salvando..." inverse />
                ) : (
                  <>
                    <i className="fa-solid fa-check" />
                    Salvar perfil
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}

        {open && activeTab === 'stats' && <ProfileWeeklyStats userId={usuario?.id} />}
      </div>
    </Modal>
  )
}
