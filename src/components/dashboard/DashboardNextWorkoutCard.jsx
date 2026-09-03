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
      <Card hover={false} className="dashboard-surface flex min-h-[330px] flex-col border-slate-200 bg-white p-6 dark:border-white/[0.08] dark:bg-[#090909] sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Próxima ação</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white">Escolha o seu próximo treino</h2>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-muted text-primary dark:bg-blue-950/60 dark:text-blue-300" aria-hidden="true">
            <i className="fa-solid fa-arrow-right" />
          </div>
        </div>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
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
    <Card hover={false} className="dashboard-surface flex min-h-[330px] flex-col border-slate-200 bg-white p-6 dark:border-white/[0.08] dark:bg-[#090909] sm:p-8">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{isToday ? 'Treino de hoje' : 'Próximo treino'}</p>
          <p className="mt-2 text-sm capitalize text-slate-500 dark:text-slate-400">{isToday ? 'Hoje' : dateLabel}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-muted text-primary dark:bg-blue-950/60 dark:text-blue-300" aria-hidden="true">
          <i className={`fa-solid ${isToday ? 'fa-play' : 'fa-calendar-check'}`} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 dark:text-white">{workoutName}</h2>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
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
