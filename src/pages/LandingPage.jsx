import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import LandingExperience from '../features/landing/LandingExperience'

export default function LandingPage() {
  const navigate = useNavigate()
  const { usuario, loading } = useAuth()

  // If user is already authenticated, redirect to dashboard
  useEffect(() => {
    if (!loading && usuario) {
      navigate('/dashboard')
    }
  }, [usuario, loading, navigate])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-slate-900 dark:text-slate-50">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/80 px-6 py-5 shadow-lg shadow-blue-900/10 ring-1 ring-slate-200/70 backdrop-blur dark:bg-[#080808]/95 dark:shadow-black/50 dark:ring-white/10">
          <LoadingSpinner className="h-12 w-12" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Carregando...</p>
        </div>
      </div>
    )
  }

  // If user is authenticated, don't render the landing page
  if (usuario) {
    return null
  }

  return <LandingExperience />
}
