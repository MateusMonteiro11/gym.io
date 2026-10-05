import Card from '../ui/Card'
import Button from '../ui/Button'
import { parseDateTime } from '../../utils/dateUtils'

function workoutCounts(appointment) {
  const sections = appointment?.treino?.secoes_treino || []
  return {
    sections: sections.length,
    exercises: sections.reduce((total, section) => total + (section?.treinos_exercicios?.length || 0), 0),
  }
}

export default function DashboardNextWorkoutCard({ appointment, onStart, onView, onChoose }) {
  if (!appointment) {
    return (
      <Card hover={false} className="dashboard-surface flex min-h-[330px] flex-col border-app-line bg-app-surface p-6 sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-accent">Próxima ação</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-app-ink">Escolha o seu próximo treino</h2>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-app-selection text-app-accent" aria-hidden="true">
            <i className="fa-solid fa-arrow-right" />
          </div>
        </div>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-app-secondary">
          Você não tem um treino agendado. Explore o catálogo e comece quando estiver pronto.
        </p>
        <div className="mt-auto pt-8">
          <Button className="min-h-11 w-full sm:w-auto" onClick={onChoose}>
            Escolher treino <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    )
  }

  const todayKey = new Date().toLocaleDateString('sv-SE')
  const isToday = appointment.data_agendada === todayKey
  const date = parseDateTime(appointment.data_agendada)
  const counts = workoutCounts(appointment)
  const workoutName = appointment?.treino?.nome || 'Treino'
  const dateLabel = date?.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <Card hover={false} className="dashboard-surface flex min-h-[330px] flex-col border-app-line bg-app-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-accent">{isToday ? 'Treino de hoje' : 'Próximo treino'}</p>
          <p className="mt-2 text-sm capitalize text-app-secondary">{isToday ? 'Hoje' : dateLabel}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-app-selection text-app-accent" aria-hidden="true">
          <i className={`fa-solid ${isToday ? 'fa-play' : 'fa-calendar-check'}`} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-app-ink">{workoutName}</h2>
        <p className="mt-4 text-sm text-app-secondary">
          {counts.sections} {counts.sections === 1 ? 'seção' : 'seções'} <span aria-hidden="true">•</span>{' '}
          {counts.exercises} {counts.exercises === 1 ? 'exercício' : 'exercícios'}
        </p>
      </div>

      <div className="mt-auto pt-8">
        <Button
          variant={isToday ? 'primary' : 'secondary'}
          className="min-h-11 w-full sm:w-auto"
          onClick={() => (isToday ? onStart(appointment) : onView(appointment.id_treino))}
        >
          {isToday ? 'Iniciar treino' : 'Ver treino'}
          <i className={`fa-solid ${isToday ? 'fa-play' : 'fa-arrow-right'} text-xs`} aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}
