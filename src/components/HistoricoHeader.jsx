import Card from './ui/Card'
import { ui } from '../styles/theme'
import { layout } from '../styles/layout'

export default function HistoricoHeader({ stats }) {
  const statCards = [
    { label: 'Total de treinos', value: stats?.totalTreinos || '0', icon: 'fa-dumbbell' },
    { label: 'Total de exercícios', value: stats?.totalExercicios || '0', icon: 'fa-fire' },
    { label: 'Dias semanais', value: stats?.diasSemanais || '0', icon: 'fa-calendar' },
    { label: 'Duração média', value: stats?.duracaoMedia || '0s', icon: 'fa-hourglass-end' },
  ]

  return (
    <header className="mb-8">
      <h1 className={ui.pageTitle}>Histórico de treinos</h1>
      <p className={ui.pageSubtitle}>Visualize o seu progresso ao longo do tempo</p>
      <div className={layout.historyStatsGrid}>
        {statCards.map((stat) => (
          <Card key={stat.label} className={ui.cardPadding}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-app-secondary">{stat.label}</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-selection text-app-accent">
                <i className={`fa-solid ${stat.icon} `} />
              </span>
            </div>
            <p className="text-2xl font-bold text-app-ink">{stat.value}</p>
          </Card>
        ))}
      </div>
    </header>
  )
}
