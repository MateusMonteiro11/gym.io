import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck } from 'lucide-react'
import { cadastrar } from '../services/auth/authService'
import { useUi } from '../contexts/UiContext'
import { getUserFriendlyErrorMessage, logError } from '../utils/errorMessages'
import AuthShell from '../components/ui/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import TermsAndPrivacyModal from '../components/TermsAndPrivacyModal'
import ActionLoading from '../components/ui/ActionLoading'

const formMotion = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut', staggerChildren: 0.055 },
  },
}

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export default function Cadastro() {
  const navigate = useNavigate()
  const { notify } = useUi()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [termos, setTermos] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [initialLegalDocument, setInitialLegalDocument] = useState('terms')

  function openLegalDocument(documentId) {
    setInitialLegalDocument(documentId)
    setTermsModalOpen(true)
  }

  function validarForcaSenha(senhaTemp) {
    const temLetra = /[a-zA-Z]/.test(senhaTemp)
    const temNumero = /[0-9]/.test(senhaTemp)
    const temCaractereEspecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senhaTemp)
    const temComprimento = senhaTemp.length >= 6

    return {
      valida: temLetra && temNumero && temCaractereEspecial && temComprimento,
      temLetra,
      temNumero,
      temCaractereEspecial,
      temComprimento,
    }
  }

  function validarFormulario() {
    const novoErros = {}
    if (!nome.trim()) novoErros.nome = 'Seu nome é obrigatório'
    if (!email.trim()) novoErros.email = 'Seu email é obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) novoErros.email = 'Email inválido'
    if (!senha) {
      novoErros.senha = 'Senha é obrigatória'
    } else {
      const validacao = validarForcaSenha(senha)
      if (!validacao.valida) {
        const requisitos = []
        if (!validacao.temComprimento) requisitos.push('mínimo 6 caracteres')
        if (!validacao.temLetra) requisitos.push('uma letra')
        if (!validacao.temNumero) requisitos.push('um número')
        if (!validacao.temCaractereEspecial) requisitos.push('um caractere especial')
        novoErros.senha = `Faltam: ${requisitos.join(', ')}`
      }
    }
    if (!confirmarSenha) novoErros.confirmarSenha = 'Confirmação de senha é obrigatória'
    else if (senha !== confirmarSenha) novoErros.confirmarSenha = 'As senhas não coincidem'
    if (!termos) novoErros.termos = 'Você deve concordar com os termos'
    setErrors(novoErros)
    return Object.keys(novoErros).length === 0
  }

  async function handleCadastro(e) {
    e.preventDefault()
    if (!validarFormulario()) return
    try {
      setLoading(true)
      await cadastrar({ nome, email, senha })
      notify({ title: 'Conta criada', message: 'Faça login para continuar.', type: 'success' })
      navigate('/login')
    } catch (error) {
      const message = getUserFriendlyErrorMessage(error, 'Não foi possível criar sua conta.')
      logError(error, '[Cadastro] Failed to sign up')
      notify({ title: 'Erro no cadastro', message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const senhaValida = validarForcaSenha(senha)

  return (
    <>
      <AuthShell
        brand={
          <>
            <h1 className="mt-0 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Comece agora a organizar seus treinos.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/82 sm:text-lg">
              Reserve seu acesso e comece a treinar.
            </p>
          </>
        }
        form={
          <motion.div className="mx-auto w-full max-w-md mt-4 md:mt-6" initial="hidden" animate="visible" variants={formMotion}>
            <motion.div variants={itemMotion} className="mb-8">
              <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">Crie sua conta</h2>
            </motion.div>

            <motion.form onSubmit={handleCadastro} className="space-y-4" variants={formMotion}>
              <Input
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                maxLength={80}
                onChange={(e) => {
                  setNome(e.target.value)
                  if (errors.nome) setErrors({ ...errors, nome: '' })
                }}
                error={errors.nome}
                containerClassName="space-y-0"
              />

              <Input
                type="text"
                placeholder="seu@email.com"
                value={email}
                maxLength={254}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors({ ...errors, email: '' })
                }}
                error={errors.email}
                containerClassName="space-y-0"
              />

              <div className="relative">
                <Input
                  type="password"
                  placeholder="Sua senha"
                  value={senha}
                  maxLength={72}
                  onChange={(e) => {
                    setSenha(e.target.value)
                    if (errors.senha) setErrors({ ...errors, senha: '' })
                  }}
                  error={errors.senha}
                  containerClassName="space-y-0"
                />
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={senha ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <motion.div
                          className={`h-full rounded-full ${senhaValida.valida ? 'bg-success' : senha.length >= 4 ? 'bg-amber-500' : 'bg-danger'}`}
                          initial={{ width: 0 }}
                          animate={{
                            width: senhaValida.valida ? '100%' : senha.length >= 4 ? '66%' : '33%',
                          }}
                          transition={{ duration: 0.5, type: 'spring', stiffness: 100, damping: 20 }}
                        />
                      </div>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${
                        senhaValida.valida ? 'bg-success/muted text-success' : senha.length >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-danger/muted text-danger'
                      }`}
                    >
                      {senhaValida.valida ? '✓ Segura' : senha.length >= 4 ? '◐ Média' : '○ Fraca'}
                    </span>
                  </div>
                </motion.div>
              </div>

              <Input
                type="password"
                placeholder="Repita sua senha"
                value={confirmarSenha}
                maxLength={72}
                onChange={(e) => {
                  setConfirmarSenha(e.target.value)
                  if (errors.confirmarSenha) setErrors({ ...errors, confirmarSenha: '' })
                }}
                error={errors.confirmarSenha}
                containerClassName="space-y-0"
              />

              <motion.div animate={errors.termos ? { x: [-2, 2, -2, 2, 0] } : {}} transition={{ duration: 0.3 }}>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-primary/20 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className={`h-4 w-4 rounded border transition-colors duration-200 ${errors.termos ? 'border-red-300 bg-red-50' : 'border-slate-300'} text-primary`}
                    checked={termos}
                    onChange={(e) => {
                      setTermos(e.target.checked)
                      if (errors.termos) setErrors({ ...errors, termos: '' })
                    }}
                  />
                  <span>
                    Concordo com os{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        openLegalDocument('terms')
                      }}
                      className="font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      termos jurídicos
                    </button>
                  </span>
                </label>
              </motion.div>

              <motion.div variants={itemMotion}>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? <ActionLoading label="Criando conta..." inverse /> : 'Criar a conta'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </motion.div>

              <motion.p variants={itemMotion} className="text-center text-sm text-slate-600 dark:text-slate-300">
                Já possuí uma conta?{' '}
                <Link to="/login" className="font-semibold text-primary hover:text-primary-hover">
                  Entrar
                </Link>
              </motion.p>
            </motion.form>
          </motion.div>
        }
      />

      <TermsAndPrivacyModal
        open={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        initialDocument={initialLegalDocument}
      />
    </>
  )
}
