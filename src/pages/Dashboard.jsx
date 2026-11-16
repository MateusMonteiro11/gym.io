import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import DashboardMomentumCard from '../components/dashboard/DashboardMomentumCard'
import DashboardNextWorkoutCard from '../components/dashboard/DashboardNextWorkoutCard'
import DashboardQuickMetric from '../components/dashboard/DashboardQuickMetric'
import WorkoutConsistencyHeatmap from '../components/dashboard/WorkoutConsistencyHeatmap'
import PageHeader from '../components/ui/PageHeader'
import ContentEntrance from '../components/ui/ContentEntrance'
import PageLoadingBoundary from '../components/ui/PageLoadingBoundary'
import { useAgendamentos } from '../hooks/useAgendamentos'
import { useAuth } from '../hooks/useAuth'
import { useHistorico } from '../hooks/useHistorico'
import { getDashboardInsights } from '../utils/dashboardInsights'

function periodComparison(delta, zeroCopy) {
  if (delta > 0) return `+${delta} em relação ao período anterior`
  if (delta < 0) return `${Math.abs(delta)} a menos que no período anterior`
  return zeroCopy
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { historico, loading: historicoLoading } = useHistorico(usuario?.id)
  const { agendamentos, loading: agendamentosLoading } = useAgendamentos()
  const isLoading = historicoLoading || agendamentosLoading
  const insights = useMemo(() => getDashboardInsights(historico), [historico])
  const nextAppointment = agendamentos?.[0] || null
  const dataAtual = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())

  const handleStart = (appointment) => {
    if (!appointment?.id_treino) return
    navigate(`/treinar/${appointment.id_treino}`, {
      state: { descansoPadrao: appointment.tempo_descanso ?? 60 },
    })
  }

  return (
    <PageLoadingBoundary loading={isLoading} loadingMessage="Carregando painel...">
      <ContentEntrance>
        <PageHeader title="Painel" subtitle={dataAtual}>
          <p className="max-w-sm text-sm leading-relaxed text-app-secondary sm:text-right">
            Seu sucesso está na próxima decisão.
          </p>
        </PageHeader>
      </ContentEntrance>

      <main className="space-y-6" aria-label="Resumo do seu ritmo de treinos">
        <ContentEntrance as="section" index={1} className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]" aria-label="Destaques do painel">
          <DashboardMomentumCard insights={insights} />
          <DashboardNextWorkoutCard
            appointment={nextAppointment}
            onStart={handleStart}
            onView={(id) => id && navigate(`/treinos/visualizar/${id}`)}
            onChoose={() => navigate('/treinar')}
          />
        </ContentEntrance>

        <ContentEntrance as="section" index={2} className="grid gap-6 md:grid-cols-2" aria-label="Indicadores de curto prazo">
          <DashboardQuickMetric
            eyebrow="Neste mês"
            value={insights.currentMonthExercises}
            label={insights.currentMonthExercises === 1 ? 'exercício' : 'exercícios'}
            detail={periodComparison(insights.monthDelta, insights.currentMonthExercises === 0 ? 'Seu primeiro exercício do mês pode começar hoje.' : 'Mesmo volume do mês anterior')}
            icon="fa-calendar-days"
          />
          <DashboardQuickMetric
            eyebrow="Neste trimestre"
            value={insights.currentQuarterExercises}
            label={insights.currentQuarterExercises === 1 ? 'exercício' : 'exercícios'}
            detail={periodComparison(insights.quarterDelta, insights.currentQuarterExercises === 0 ? 'Seu primeiro exercício do trimestre pode começar hoje.' : 'Mesmo volume do trimestre anterior')}
            icon="fa-bolt"
          />
        </ContentEntrance>

        <ContentEntrance as="section" index={3} aria-label="Consistência anual">
          <WorkoutConsistencyHeatmap key={usuario?.id} userId={usuario?.id} />
        </ContentEntrance>
      </main>
    </PageLoadingBoundary>
  )
}
