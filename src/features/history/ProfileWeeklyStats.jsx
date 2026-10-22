import { Clock3, Flame, Layers3, ListChecks } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { ui } from '../../styles/theme.js'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import Button from '../../components/ui/Button.jsx'
import { formatAverageWorkoutDuration } from '../../utils/workoutDuration.js'
import { createHistoryRepository } from './historyRepository.js'
import { numberLabel } from './historyModel.js'
import { useWeeklyProfileStats } from './useWeeklyProfileStats.js'

const historyRepository = createHistoryRepository(supabase)

export default function ProfileWeeklyStats({ userId, repository = historyRepository, clock }) {
  const { status, stats, retry } = useWeeklyProfileStats(repository, userId, clock)
  if (status === 'loading') return <div className="space-y-4" role="status" aria-label="Carregando estatísticas da semana">
    <Skeleton className="h-5 w-48 rounded" />
    <div className="grid grid-cols-2 gap-4">{[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-32 rounded-2xl" />)}</div>
  </div>
  if (status === 'error') return <div className="space-y-4 py-4" role="alert">
    <p className="text-sm text-app-secondary">Não foi possível carregar as estatísticas da semana.</p>
    <Button variant="secondary" onClick={retry}>Tentar novamente</Button>
  </div>

  const cards = [
    { label: 'Exercícios', value: numberLabel(stats.exercises), icon: ListChecks, reliable: stats.reliability.exercises, context: 'Execuções na semana' },
    { label: 'Séries', value: numberLabel(stats.series), icon: Layers3, reliable: stats.reliability.series, context: 'Séries concluídas' },
    { label: 'Sequência', value: `${stats.streak} ${stats.streak === 1 ? 'dia' : 'dias'}`, icon: Flame, reliable: true, context: 'Dias seguidos nesta semana' },
    { label: 'Duração', value: formatAverageWorkoutDuration(stats.workouts ? stats.averageDuration : null), icon: Clock3, reliable: stats.reliability.duration, context: 'Tempo médio por sessão' },
  ]
  return <section className="space-y-4" aria-label="Estatísticas da semana">
    <div>
      <h3 className="font-semibold text-app-ink">Esta semana</h3>
      <p className="mt-1 text-sm text-app-secondary">Domingo a sábado</p>
    </div>
    {!stats.workouts && <p className="text-sm text-app-secondary">Nenhum treino concluído nesta semana.</p>}
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {cards.map(({ label, value, icon: Icon, reliable, context }) => <div key={label} className={ui.card}>
        <dl className="p-4 sm:p-5">
          <dt className="flex min-h-5 items-center gap-2 text-xs font-medium leading-5 text-app-secondary sm:text-sm">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
            <span className="leading-5">{label}</span>
          </dt>
          <dd className="mt-3 text-2xl font-bold tabular-nums text-app-accent sm:text-3xl">{value}</dd>
          <dd className="mt-2 text-xs text-app-secondary">{context}</dd>
          {!reliable && <dd className="mt-1 text-xs text-app-secondary">{value === '—' ? 'Informação não registrada' : 'Dados parciais'}</dd>}
        </dl>
      </div>)}
    </div>
    {stats.partial && <p className="text-xs text-app-secondary">Alguns registros estão incompletos. Os valores disponíveis podem representar apenas parte da semana.</p>}
  </section>
}
