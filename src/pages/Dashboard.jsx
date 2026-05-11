import Sidebar from '../components/Sidebar'

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

const statsCards = [
  { label: 'Total de treinos', value: '4', sub: 'Desde o início' },
  { label: 'Esta semana', value: '2', sub: 'Últimos 7 dias' },
  { label: 'Total de exercícios', value: '14', sub: 'Concluídos' },
  { label: 'Duração média', value: '68 min', sub: 'Por treino' },
]

const recentActivity = [
  { name: 'Braço completo', date: '3 de Mar.', info: '4 exercícios • 65 min' },
  { name: 'Treino de pernas', date: '1 de Mar.', info: '3 exercícios • 70 min' },
  { name: 'Treino de costas', date: '27 de Fev.', info: '3 exercícios • 55 min' },
]

export default function Dashboard() {

  useEffect(() => {

    async function testarSupabase() {

      const { data, error } = await supabase
        .from('treinos')
        .select('*')

      console.log('TREINOS:', data)
      console.log('ERRO:', error)
    }

    testarSupabase()

  }, [])

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Painel</h1>
          <p className="text-gray-400">Sábado, 05 de março de 2026</p>
        </div>

        {/* restante do código */}
      </main>
    </div>
  )
}