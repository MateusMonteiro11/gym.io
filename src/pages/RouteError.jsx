import { useEffect } from 'react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'

import logoImg from '../assets/images/logo_blue.png'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { logError } from '../utils/errorMessages'

function RouteErrorView({ code, title, message, errorToLog }) {
  const navigate = useNavigate()
  const { usuario, loading } = useAuth()
  const hasAuthenticatedUser = !loading && Boolean(usuario)
  const destination = hasAuthenticatedUser ? '/dashboard' : '/'

  useEffect(() => {
    if (errorToLog) {
      logError(errorToLog, '[Router] Failed to render route')
    }
  }, [errorToLog])

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-canvas px-4 py-20 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,87,247,0.16),transparent_32%),radial-gradient(circle_at_85%_75%,rgba(20,87,247,0.1),transparent_28%)]"
        aria-hidden
      />

      <header className="absolute inset-x-0 top-0 z-10 px-4 py-4 sm:px-8 sm:py-6">
        <button
          type="button"
          onClick={() => navigate(destination, { replace: true })}
          className="flex cursor-pointer items-center gap-3 rounded-xl text-left transition-opacity hover:opacity-80"
          aria-label={hasAuthenticatedUser ? 'Ir para o Dashboard' : 'Ir para a página inicial'}
        >
          <img src={logoImg} className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-slate-200/80" alt="" />
          <span className="font-semibold tracking-tight text-slate-900">Gym.io</span>
        </button>
      </header>

      <Card hover={false} className="relative w-full max-w-xl p-6 text-center shadow-xl shadow-slate-900/5 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-muted text-2xl text-primary dark:bg-slate-800 dark:text-white">
          <i className={`fa-solid ${code === 404 ? 'fa-signs-post' : 'fa-triangle-exclamation'}`} />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Erro {code}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">{message}</p>
        <Button className="mt-7 w-full sm:w-auto" onClick={() => navigate(destination, { replace: true })}>
          <i className="fa-solid fa-arrow-left" />
          {hasAuthenticatedUser ? 'Voltar ao Dashboard' : 'Voltar ao início'}
        </Button>
      </Card>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <RouteErrorView
      code={404}
      title="Página não encontrada"
      message="O endereço informado não existe ou não está mais disponível."
    />
  )
}

export default function RouteError() {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <RouteErrorView
      code={isRouteErrorResponse(error) ? error.status : 500}
      title={isNotFound ? 'Página não encontrada' : 'Não foi possível abrir esta página'}
      message={
        isNotFound
          ? 'O endereço informado não existe ou não está mais disponível.'
          : 'Tivemos um problema ao carregar este conteúdo. Você pode retornar e tentar novamente.'
      }
      errorToLog={error}
    />
  )
}
