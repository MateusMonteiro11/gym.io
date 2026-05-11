import { Navigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

export function PrivateRoute({
  children
}) {

  const {
    usuario,
    loading
  } = useAuth()

  if (loading) {

    return (
      <p className="p-10">
        Carregando...
      </p>
    )
  }

  if (!usuario) {

    return <Navigate to="/login" />
  }

  return children
}