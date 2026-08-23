import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useHistorico } from '../hooks/useHistorico'
import { useUi } from '../contexts/UiContext'
import { atualizarUsuario, uploadFotoPerfil, obterUsuario } from '../services/usuarios/usuariosService'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import Button from './ui/Button'
import Input, { Label } from './ui/Input'
import { formatDatePtBr, formatTimePtBr } from '../utils/dateUtils'
import { ui } from '../styles/theme'
import { getUserFriendlyErrorMessage, logError } from '../utils/errorMessages'
import { validateProfileImageFile } from '../utils/imageUtils'
import { Skeleton, SkeletonList } from './ui/Skeleton'
import ActionLoading from './ui/ActionLoading'

export default function UserProfileModal({ open, onClose, onUpdate }) {
  const { usuario } = useAuth()
  const { alert, notify } = useUi()
  const { historico, loading: loadingHistorico, estatisticas } = useHistorico(
    open ? usuario?.id : null
  )

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
    { id: 'history', label: 'Histórico', icon: 'fa-history' },
    { id: 'stats', label: 'Estatísticas', icon: 'fa-chart-bar' },
  ]

  const formatDuracao = (segundos) => {
    const minutos = Math.floor(segundos / 60)
    const segs = segundos % 60
    if (minutos > 0) {
      return `${minutos}m ${segs}s`
    }
    return `${segs}s`
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader title="Meu Perfil" onClose={onClose} />

      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2 flex-1 px-6 py-4 text-sm font-medium transition-colors duration-200 border-b-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className={`fa-solid ${tab.icon} text-base`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="p-6">
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
                <div className="h-24 w-24 rounded-full bg-primary-muted flex items-center justify-center text-4xl text-primary overflow-hidden">
                  {fotoPreview ? (
                    <img
                      src={fotoPreview}
                      alt="Foto"
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                        event.currentTarget.parentElement?.classList?.add('bg-slate-200')
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
                <span className={`inline-flex items-center gap-2 text-sm text-primary font-medium hover:text-primary-hover transition-colors ${salvando ? 'opacity-50' : ''}`}>
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

        {/* Historico */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {loadingHistorico ? (
              <div role="status" aria-label="Carregando histórico...">
                <SkeletonList items={3} compact />
              </div>
            ) : historico?.length > 0 ? (
              <div className="space-y-3">
                {historico.slice(0, 10).map((treino) => (
                  <div key={treino.id_historico} className={ui.card}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 truncate">
                            {treino.treinos?.nome || 'Treino'}
                          </h4>
                          <p className="text-sm text-slate-600 mt-1">
                            <i className="fa-solid fa-calendar mr-2" />
                            {formatDatePtBr(treino.data_execucao)} às {formatTimePtBr(treino.data_execucao)}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            <i className="fa-solid fa-clock mr-2" />
                            {formatDuracao(treino.duracao_segundos || 0)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-sm">
                          <span className="inline-flex items-center gap-1 bg-primary-muted text-primary px-2.5 py-1 rounded-lg">
                            <i className="fa-solid fa-dumbbell" />
                            {treino.total_series || 0} séries
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className={ui.emptyIcon}>
                  <i className="fa-solid fa-history" />
                </div>
                <p className="text-slate-600 text-sm">Nenhum treino registrado ainda</p>
              </div>
            )}
          </div>
        )}

        {/* Estatisticas */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className={ui.card}>
                <div className="p-6">
                  <p className="text-sm text-slate-600 mb-2">
                    <i className="fa-solid fa-dumbbell mr-2" />
                    Total de Treinos
                  </p>
                  <p className="text-3xl font-bold text-primary">{estatisticas.totalTreinos}</p>
                </div>
              </div>

              <div className={ui.card}>
                <div className="p-6">
                  <p className="text-sm text-slate-600 mb-2">
                    <i className="fa-solid fa-fire mr-2" />
                    Total de Séries
                  </p>
                  <p className="text-3xl font-bold text-primary">{estatisticas.totalExercicios}</p>
                </div>
              </div>

              <div className={ui.card}>
                <div className="p-6">
                  <p className="text-sm text-slate-600 mb-2">
                    <i className="fa-solid fa-hourglass-end mr-2" />
                    Duração Média
                  </p>
                  <p className="text-2xl font-bold text-primary">{estatisticas.duracaoMedia}</p>
                </div>
              </div>

              <div className={ui.card}>
                <div className="p-6">
                  <p className="text-sm text-slate-600 mb-2">
                    <i className="fa-solid fa-calendar-week mr-2" />
                    Dias Esta Semana
                  </p>
                  <p className="text-3xl font-bold text-primary">{estatisticas.diasSemanais}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
