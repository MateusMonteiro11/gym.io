import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import LandingExperience from '../features/landing/LandingExperience'
import LandingLoadingState from '../features/landing/LandingLoadingState'

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
    return <LandingLoadingState />
  }

  // If user is authenticated, don't render the landing page
  if (usuario) {
    return null
  }

  return <LandingExperience />
}
