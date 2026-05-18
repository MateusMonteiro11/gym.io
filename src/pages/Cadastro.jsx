import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import cadastroImg from '../assets/images/Cadastro.png'
import { cadastrar } from '../services/auth/authService'
import { useUi } from '../contexts/UiContext'
import AuthShell from '../components/ui/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Cadastro() {
  const navigate = useNavigate()
  const { alert, notify } = useUi()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCadastro(e) {
    e.preventDefault()
    if (senha !== confirmarSenha) {
      alert({ title: 'Senhas diferentes', message: 'As senhas não coincidem.', type: 'warning' })
      return
    }
    try {
      setLoading(true)
      await cadastrar({ nome, email, senha })
      notify({ title: 'Conta criada', message: 'Faça login para continuar.', type: 'success' })
      navigate('/login')
    } catch (error) {
      alert({ title: 'Erro no cadastro', message: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      brand={
        <>
          <img src={cadastroImg} alt="Cadastro" className="mx-auto mb-10 w-40 md:w-64" />
          <h1 className="mb-4 text-3xl font-extrabold md:text-4xl">Comece agora</h1>
          <p className="mb-4 text-lg font-semibold">Inicie sua jornada de treinos conosco</p>
          <p className="text-white/90">É prático, rápido e seguro</p>
        </>
      }
      form={
        <div className="mx-auto w-full max-w-md">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900 md:text-3xl">Cadastro</h2>
          <form onSubmit={handleCadastro} className="space-y-4">
            <Input type="text" placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <Input type="password" placeholder="Repita sua senha" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary" required />
              Concordo com os termos
            </label>
            <Button type="submit" disabled={loading} className="w-full text-lg">
              {loading ? 'Criando conta...' : 'Criar a conta'}
            </Button>
            <p className="text-center text-sm text-slate-600">
              Já possui uma conta?{' '}
              <Link to="/login" className="font-medium text-primary hover:text-primary-hover">Entrar</Link>
            </p>
          </form>
        </div>
      }
    />
  )
}
