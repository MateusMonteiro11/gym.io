import Sidebar from '../components/Sidebar'
import LoadingState from '../components/ui/LoadingState'

export default function DashboardLayout({ children, loading, loadingMessage }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
      <Sidebar />
      <main className="flex flex-1 flex-col p-6 md:p-8">
        <div className="mx-auto w-full max-w-7xl flex-1">
          {loading ? <LoadingState message={loadingMessage} /> : children}
        </div>
      </main>
    </div>
  )
}
