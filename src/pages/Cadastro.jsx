import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

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

  async function handleCadastro(e) {

    e.preventDefault()

    if (senha !== confirmarSenha) {

      alert({
        title   : 'Senhas diferentes',
        message : 'As senhas não coincidem.',
        type    : 'warning',
      })

      return
    }

    const validacao = validarForcaSenha(senha)

    if (!validacao.valida) {

      const requisitos = []
      
      if (!validacao.temComprimento) requisitos.push(' A senha precisa ter no mínimo 6 caracteres')
      if (!validacao.temLetra) requisitos.push(' A senha precisa ter pelo menos uma letra')
      if (!validacao.temNumero) requisitos.push(' A senha precisa ter pelo menos um número')
      if (!validacao.temCaractereEspecial) requisitos.push(' A senha precisa ter pelo menos um caractere especial')

      alert({
        title   : 'Senha fraca',
        message : `Sua senha não atende aos requisitos de segurança:\n${requisitos.join('\n')}`,
        type    : 'warning',
      })

      return
    }

    try {

      setLoading(true)

      /*
      ─────────────────────────────────────────
      1. Cria usuário
      ─────────────────────────────────────────
      */

      await cadastrar({

        nome,
        email,
        senha,

      })

      /*
      ─────────────────────────────────────────
      2. Feedback
      ─────────────────────────────────────────
      */

      notify({

        title   : 'Conta criada',
        message : 'Faça login para continuar.',
        type    : 'success',

      })

      navigate('/login')

    } catch (error) {

      alert({

        title   : 'Erro no cadastro',
        message : error.message,
        type    : 'error',

      })

    } finally {

      setLoading(false)

    }
  }

  return (

    <AuthShell

      brand={
        <>

          <img
            src={cadastroImg}
            alt="Cadastro"
            className="mx-auto mb-10 w-40 md:w-64"
          />

          <h1 className="mb-4 text-3xl font-extrabold md:text-4xl">
            Comece agora
          </h1>

          <p className="mb-4 text-lg font-semibold">
            Inicie sua jornada de treinos conosco
          </p>

          <p className="text-white/90">
            É prático, rápido e seguro
          </p>

        </>
      }

      form={
        <div className="mx-auto w-full max-w-md">

          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900 md:text-3xl">
            Cadastro
          </h2>

          <form
            onSubmit={handleCadastro}
            className="space-y-4"
          >

            <Input
              type="text"
              placeholder="Seu nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />

            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="relative">
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
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
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">

              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary"
                required
              />

              Concordo com os termos

            </label>

            <Button
              type="submit"
              disabled={loading}
              className="w-full text-lg"
            >

              {loading
                ? 'Criando conta...'
                : 'Criar a conta'}

            </Button>

            <p className="text-center text-sm text-slate-600">

              Já possui uma conta?{' '}

              <Link
                to="/login"
                className="font-medium text-primary hover:text-primary-hover"
              >
                Entrar
              </Link>

            </p>

          </form>

        </div>
      }
    />
  )
}