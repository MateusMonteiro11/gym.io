import { useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import LoadingState from '../components/ui/LoadingState'
import { resolveLoadingVariant } from '../components/ui/loadingVariants'

export default function DashboardLayout({ children, loading, loadingMessage }) {
  const { pathname } = useLocation()
  const loadingVariant = resolveLoadingVariant(pathname)

  return (
    <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col p-6 md:p-8">
        <div className="mx-auto min-w-0 w-full max-w-7xl flex-1">
          {loading ? <LoadingState message={loadingMessage} variant={loadingVariant} /> : children}
        </div>
      </main>
    </div>
  )
}
