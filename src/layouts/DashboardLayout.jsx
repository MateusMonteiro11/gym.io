import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { PageMotionProvider } from '../components/ui/ContentEntrance'
import Sidebar from '../components/Sidebar'
import LoadingState from '../components/ui/LoadingState'
import { resolveLoadingVariant } from '../components/ui/loadingVariants'
import '../styles/mobileNavigation.css'

export default function DashboardLayout({ children, loading, loadingMessage }) {
  const { pathname } = useLocation()
  const loadingVariant = resolveLoadingVariant(pathname)
  const isTraining = pathname.startsWith('/treinar/')

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('app-context')
    return () => root.classList.remove('app-context')
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div className={`app-shell flex min-h-screen flex-col bg-app-canvas text-app-ink md:flex-row ${isTraining ? 'app-shell--training' : ''}`}>
        <Sidebar />
        <PageMotionProvider pageKey={pathname}>
          <main className="app-main flex min-w-0 flex-1 flex-col p-6 md:p-8">
            <div className="mx-auto min-w-0 w-full max-w-7xl flex-1">
              {loading ? <LoadingState message={loadingMessage} variant={loadingVariant} /> : children}
            </div>
          </main>
        </PageMotionProvider>
      </div>
    </MotionConfig>
  )
}
