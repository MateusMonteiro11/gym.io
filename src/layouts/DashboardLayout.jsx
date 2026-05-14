import Sidebar from '../components/Sidebar'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8">
        {children}
      </main>
    </div>
  )
}
