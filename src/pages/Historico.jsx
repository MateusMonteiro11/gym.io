import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import HistoryView from '../features/history/HistoryView.jsx'
import { createHistoryRepository } from '../features/history/historyRepository.js'

const repository = createHistoryRepository(supabase)

export default function Historico() {
  const { usuario } = useAuth()
  return <HistoryView key={usuario?.id || 'signed-out'} userId={usuario?.id} repository={repository} />
}
