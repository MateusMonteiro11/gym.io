import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import logoImg from '../assets/images/logo.png'
import { login, resetPassword } from '../services/auth/authService'
import { useUi } from '../contexts/UiContext'
import AuthShell from '../components/ui/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ModalHeader from '../components/ui/ModalHeader'

const formMotion = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut', staggerChildren: 0.06 },
  },
}

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export default function Login() {
  const navigate = useNavigate()
  const { alert, notify } = useUi()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [resetErrors, setResetErrors] = useState({})

  function validarFormulario() {
    const novoErros = {}

    if (!email.trim()) novoErros.email = 'Digite seu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) novoErros.email = 'Email invalido'

    if (!senha) novoErros.senha = 'Digite sua senha'

    setErrors(novoErros)
    return Object.keys(novoErros).length === 0
  }

  function validarResetEmail() {
    const novoErros = {}

    if (!resetEmail.trim()) novoErros.resetEmail = 'Digite seu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) novoErros.resetEmail = 'Email invalido'

    setResetErrors(novoErros)
    return Object.keys(novoErros).length === 0
  }

  async function handleLogin(e) {
    e.preventDefault()

    if (!validarFormulario()) return

    try {
      setLoading(true)
      await login(email, senha)
      navigate('/dashboard')
    } catch (error) {
      alert({ title: 'Erro ao entrar', message: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()

    if (!validarResetEmail()) return

    try {
      setResetLoading(true)
      await resetPassword(resetEmail)
      notify({
        title: 'Email enviado',
        message: 'Verifique sua caixa de entrada para redefinir a senha.',
        type: 'success',
      })
      setIsModalOpen(false)
      setResetEmail('')
      setResetErrors({})
    } catch (error) {
      alert({ title: 'Erro', message: error.message, type: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <>
      <AuthShell
        brand={
          <>
            <motion.img
              src={logoImg}
              alt="GYM.IO"
              className="mx-auto mb-6 w-20 drop-shadow-xl sm:w-28 md:mb-8 md:w-48"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-4xl">Bem-vindo de volta</h1>
            <p className="mx-auto mb-5 max-w-sm text-base font-medium leading-7 text-white/80 md:mb-6 md:text-lg">
              Continue organizando treinos, sessoes e progresso em um workspace simples.
            </p>
            <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
              {['Treinos', 'Historico', 'Sessao'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/30 bg-white/10 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </>
        }
        form={
          <motion.div className="mx-auto w-full max-w-md" initial="hidden" animate="visible" variants={formMotion}>
            <motion.div variants={itemMotion} className="mb-8 text-center">
              <span className="mb-4 inline-flex rounded-full border border-blue-100 bg-primary-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Login
              </span>
              <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                Acesse sua conta
              </h2>
              <p className="text-slate-600">
                Acesse sua conta para gerenciar seus treinos
              </p>
            </motion.div>

            <motion.form onSubmit={handleLogin} className="space-y-4" variants={formMotion}>
              <motion.div variants={itemMotion}>
                <Input
                  type="text"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors({ ...errors, email: '' })
                  }}
                  error={errors.email}
                  containerClassName="space-y-0"
                />
              </motion.div>

              <motion.div variants={itemMotion}>
                <Input
                  type="password"
                  placeholder="Senha"
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value)
                    if (errors.senha) setErrors({ ...errors, senha: '' })
                  }}
                  error={errors.senha}
                  containerClassName="space-y-0"
                />
              </motion.div>

              <motion.div variants={itemMotion} className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="cursor-pointer rounded-lg px-2 py-1 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary-muted hover:text-primary-hover"
                >
                  Esqueceu a senha?
                </button>
              </motion.div>

              <motion.div variants={itemMotion}>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Entrando...' : 'Entrar'}
                  {!loading && <i className="fa-solid fa-arrow-right" />}
                </Button>
              </motion.div>

              <motion.p variants={itemMotion} className="text-center text-sm text-slate-600">
                Nao tem uma conta?{' '}
                <Link to="/cadastro" className="font-medium text-primary hover:text-primary-hover">
                  Criar uma
                </Link>
              </motion.p>
            </motion.form>
          </motion.div>
        }
      />

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} size="sm">
        <ModalHeader title="Redefinir senha" subtitle="Enviaremos um link para seu email." onClose={() => setIsModalOpen(false)} />
        <form onSubmit={handleResetPassword} className="space-y-4 p-6 pt-0">
          <Input
            type="text"
            placeholder="Digite seu email"
            value={resetEmail}
            onChange={(e) => {
              setResetEmail(e.target.value)
              if (resetErrors.resetEmail) setResetErrors({ ...resetErrors, resetEmail: '' })
            }}
            error={resetErrors.resetEmail}
            containerClassName="space-y-0"
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={resetLoading} className="flex-1">
              {resetLoading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
