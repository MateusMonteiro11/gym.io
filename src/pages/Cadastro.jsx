import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

import cadastroImg from '../assets/images/logo.png'

import { cadastrar } from '../services/auth/authService'

import { useUi } from '../contexts/UiContext'
import { getUserFriendlyErrorMessage, logError } from '../utils/errorMessages'

import AuthShell from '../components/ui/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import TermsAndPrivacyModal from '../components/TermsAndPrivacyModal'

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

  const { alert, notify } = useUi()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [termos, setTermos] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)

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
        if (!validacao.temCaractereEspecial) requisitos.push(' uma caractere especial')
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

      // Cria usuario

      await cadastrar({

        nome,
        email,
        senha,

      })

      // Feedback

      notify({

        title   : 'Conta criada',
        message : 'Faça login para continuar.',
        type    : 'success',

      })

      navigate('/login')

    } catch (error) {

      const message = getUserFriendlyErrorMessage(error, 'Não foi possível criar sua conta.')
      logError(error, '[Cadastro] Failed to sign up')

      alert({

        title   : 'Erro no cadastro',
        message,
        type    : 'error',

      })

    } finally {

      setLoading(false)

    }
  }

  return (
    <>
      <AuthShell

        brand={
          <>

            <motion.img
              src={cadastroImg}
              alt="Cadastro"
              className="mx-auto mb-6 w-20 drop-shadow-xl sm:w-28 md:mb-8 md:w-48"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:mb-4 md:text-4xl">
              Comece agora
            </h1>

            <p className="mx-auto mb-4 max-w-sm text-lg font-medium leading-7 text-white/80">
              Inicie sua jornada de treinos conosco
            </p>

            <p className="mx-auto rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              É prático, rápido e seguro
            </p>

          </>
        }

        form={
          <motion.div className="mx-auto w-full max-w-md" initial="hidden" animate="visible" variants={formMotion}>

          <motion.div variants={itemMotion} className="mb-8 text-center">
            <span className="mb-4 inline-flex rounded-full border border-blue-100 bg-primary-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Cadastro
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              Crie sua conta
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Configure seu acesso e comece a organizar seus treinos.
            </p>
          </motion.div>

          <motion.form
            onSubmit={handleCadastro}
            className="space-y-4"
            variants={formMotion}
          >

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
                placeholder="Mínimo 6 caracteres"
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
                  <div className="relative flex-1">
                    <div className="h-1.5 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full overflow-hidden shadow-sm">
                      <motion.div
                        layout
                        layoutId="passwordStrength"
                        className={`h-full rounded-full ${
                          validarForcaSenha(senha).valida
                            ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                            : senha.length >= 4
                            ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                            : 'bg-gradient-to-r from-red-400 to-rose-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{
                          width: validarForcaSenha(senha).valida
                            ? '100%'
                            : senha.length >= 4
                            ? '66%'
                            : '33%',
                        }}
                        transition={{ duration: 0.5, type: 'spring', stiffness: 100, damping: 20 }}
                      />
                      
                      {validarForcaSenha(senha).valida && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                          animate={{
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <motion.span
                    key={validarForcaSenha(senha).valida ? 'segura' : senha.length >= 4 ? 'media' : 'fraca'}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className={`text-xs font-bold whitespace-nowrap px-2 py-1 rounded-full ${
                      validarForcaSenha(senha).valida
                        ? 'bg-green-100 text-green-700'
                        : senha.length >= 4
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {validarForcaSenha(senha).valida
                      ? '✓ Segura'
                      : senha.length >= 4
                      ? '◐ Média'
                      : '○ Fraca'}
                  </motion.span>
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

            <motion.div
              animate={errors.termos ? { x: [-2, 2, -2, 2, 0] } : {}}
              transition={{ duration: 0.3 }}
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/5">

                <input
                  type="checkbox"
                  className={`h-4 w-4 rounded border transition-colors duration-200 ${
                    errors.termos
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300'
                  } text-primary`}
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
                      setTermsModalOpen(true)
                    }}
                    className="font-semibold text-primary hover:text-primary-hover transition-colors duration-200"
                  >
                    termos de privacidade
                  </button>
                </span>

              </label>

              {errors.termos && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="mt-2 flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 p-3"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
                    className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-bold"
                  >
                    ⚠
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="text-sm font-medium text-red-500"
                  >
                    {errors.termos}
                  </motion.p>
                </motion.div>
              )}
            </motion.div>

            <motion.div variants={itemMotion}>
            <Button
              type="submit"
              disabled={loading}
              className="w-full text-lg"
            >

              {loading
                ? 'Criando conta...'
                : 'Criar a conta'}

            </Button>
            </motion.div>

            <motion.p variants={itemMotion} className="text-center text-sm text-slate-600">

              Já possui uma conta?{' '}

              <Link
                to="/login"
                className="font-medium text-primary hover:text-primary-hover"
              >
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
      />
    </>
  )
}
