import { useLocation } from 'react-router-dom'

import LoadingState from './LoadingState'
import { resolveLoadingVariant } from './loadingVariants'

export default function PageLoadingBoundary({ children, loading, loadingMessage }) {
  const { pathname } = useLocation()

  if (loading) {
    return (
      <LoadingState
        message={loadingMessage}
        variant={resolveLoadingVariant(pathname)}
      />
    )
  }

  return children
}
