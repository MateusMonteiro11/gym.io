import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUi } from '../contexts/UiContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { ui } from '../styles/theme'
import { getUserFriendlyErrorMessage, logError } from '../utils/errorMessages'

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const { alert, notify } = useUi()
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!senha || senha.length < 6) {
      alert({ title: 'Senha fraca', message: 'Use pelo menos 6 caracteres.', type: 'warning' })
      return
    }

    if (senha !== confirmarSenha) {
      alert({ title: 'Senhas diferentes', message: 'As senhas não coincidem.', type: 'warning' })
      return
    }
    try {
      setLoading(true)
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      notify({ title: 'Senha alterada', message: 'Faça login com sua nova senha.', type: 'success' })
      navigate('/login')
    } catch (error) {
      const message = getUserFriendlyErrorMessage(error, 'Não foi possível alterar sua senha.')
      logError(error, '[RedefinirSenha] Failed to update password')
      alert({ title: 'Erro', message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className={`w-full max-w-md ${ui.cardPadding} shadow-modal`}>
        <div className="mb-6 text-center">
          <div className={ui.emptyIcon}>
            <i className="fa-solid fa-lock" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Redefinir senha</h1>
          <p className="mt-2 text-sm text-slate-600">Escolha uma nova senha segura</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="password" placeholder="Nova senha" value={senha} maxLength={72} onChange={(e) => setSenha(e.target.value)} required />
          <Input type="password" placeholder="Confirmar senha" value={confirmarSenha} maxLength={72} onChange={(e) => setConfirmarSenha(e.target.value)} required />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Alterando...' : 'Alterar senha'}
          </Button>
        </form>
      </Card>
    </section>
  )
}
