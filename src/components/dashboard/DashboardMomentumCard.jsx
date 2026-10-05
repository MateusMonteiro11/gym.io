import Card from '../ui/Card'

const weekDayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })

function comparisonCopy(current, previous) {
  const delta = current - previous
  if (current === 0 && previous === 0) return 'Sua semana começa no próximo treino.'
  if (delta > 0) return `+${delta} em relação à semana passada`
  if (delta < 0) return `${Math.abs(delta)} a menos que na semana passada`
  return 'Mesmo ritmo da semana passada'
}

export default function DashboardMomentumCard({ insights }) {
  return (
    <Card
      hover={false}
      className="dashboard-surface dashboard-momentum-card relative min-h-[330px] overflow-hidden border-app-accent bg-app-action p-6 text-white sm:p-8"
    >
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/90">Ritmo semanal</p>
            <h2 className="mt-3 max-w-lg text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Seu movimento desta semana
            </h2>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.12] text-white" aria-hidden="true">
            <i className="fa-solid fa-chart-simple" />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-end gap-x-4 gap-y-2">
          <strong className="text-6xl font-semibold leading-none tracking-[-0.06em] text-white sm:text-7xl">
            {insights.currentWeekExercises}
          </strong>
          <div className="pb-1">
            <p className="text-sm font-medium text-white">{insights.currentWeekExercises === 1 ? 'exercício concluído' : 'exercícios concluídos'}</p>
            <p className="mt-1 text-xs text-white/90">{comparisonCopy(insights.currentWeekExercises, insights.previousWeekExercises)}</p>
          </div>
        </div>

        <div className="mt-auto pt-8">
          <div className="grid grid-cols-7 gap-2" aria-label="Atividade da semana atual">
            {insights.weekDays.map((day) => (
              <div key={day.key} className="min-w-0 text-center">
                <span className="block truncate text-[10px] font-semibold uppercase text-white/90">
                  {weekDayFormatter.format(day.date).replace('.', '')}
                </span>
                <span
                  className={`mt-2 flex h-11 items-end justify-center rounded-xl border px-1 pb-2 text-sm font-semibold transition-colors duration-200 ${
                    day.isFuture
                      ? 'border-white/[0.08] bg-white/[0.04] text-white/30'
                      : day.count > 0
                        ? 'dashboard-week-day-active border-white/30 bg-white text-app-accent'
                        : 'border-white/[0.12] bg-white/[0.08] text-white/90'
                  } ${day.isToday ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-primary' : ''}`}
                  aria-label={`${day.date.toLocaleDateString('pt-BR', { dateStyle: 'full' })}: ${day.count} ${day.count === 1 ? 'exercício concluído' : 'exercícios concluídos'}`}
                >
                  {day.count || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
