import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'

export function PrivateRoute({
  children
}) {

  const {
    usuario,
    loading
  } = useAuth()
  const location = useLocation()

  if (!loading && !usuario) {

    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return (
    <DashboardLayout loading={loading} loadingMessage="Preparando sua área...">
      {loading ? null : children}
    </DashboardLayout>
  )
}
