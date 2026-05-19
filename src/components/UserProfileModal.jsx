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

export default function UserProfileModal({ open, onClose, onUpdate }) {
  const { usuario } = useAuth()
  const { alert, notify } = useUi()
  const { historico, loading: loadingHistorico, estatisticas } = useHistorico(usuario?.id)

  const [activeTab, setActiveTab] = useState('profile')
  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('')
  const [fotoPreview, setFotoPreview] = useState(null)
  const [fotoFile, setFotoFile] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [carregandoUsuario, setCarregandoUsuario] = useState(false)

  useEffect(() => {
    if (!open || !usuario?.id) return

    const carregarDadosUsuario = async () => {
      try {
        setCarregandoUsuario(true)
        const usuarioDB = await obterUsuario(usuario.id)
        setNome(usuarioDB?.nome || usuario.email?.split('@')[0] || '')
        setStatus(usuarioDB?.status || '')
        setFotoPreview(usuarioDB?.foto_perfil || null)
        setFotoFile(null)
      } catch (err) {
        console.error('Erro ao carregar dados do usuário:', err)
        setNome(usuario.email?.split('@')[0] || '')
        setStatus('')
        setFotoPreview(null)
      } finally {
        setCarregandoUsuario(false)
      }
    }

    carregarDadosUsuario()
  }, [open, usuario])

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setFotoFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setFotoPreview(event.target?.result)
      }
      reader.readAsDataURL(file)
    }
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
        title: 'Sucesso',
        message: 'Perfil atualizado com sucesso',
        type: 'success',
      })

      onUpdate?.()
      onClose?.()
    } catch (err) {
      alert({
        title: 'Erro ao salvar',
        message: err?.message || 'Ocorreu um erro ao atualizar o perfil',
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
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors duration-200 border-b-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className={`fa-solid ${tab.icon} mr-2`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="mb-4">
                <div className="h-24 w-24 rounded-full bg-primary-muted flex items-center justify-center text-4xl text-primary overflow-hidden">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto" className="h-full w-full object-cover" />
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
                  <>
                    <i className="fa-solid fa-spinner animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check" />
                    Salvar perfil
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {loadingHistorico ? (
              <div className="flex justify-center py-8">
                <i className={ui.loadingSpinner} />
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

        {/* STATISTICS TAB */}
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
