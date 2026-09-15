import { ArrowRight, ChevronRight, Dumbbell } from 'lucide-react'
import { Link } from 'react-router-dom'

import Card from '../../components/ui/Card.jsx'
import { ui } from '../../styles/theme.js'
import { durationLabel, numberLabel, sessionMetrics, timeLabel } from './historyModel.js'

function workoutDateLabel(date) {
  const rawDateLabel = date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).replaceAll('.', '')
  const dateLabel = `${rawDateLabel.charAt(0).toUpperCase()}${rawDateLabel.slice(1)}`

  return `${dateLabel} · ${timeLabel(date)}`
}

function WorkoutCard({ session, onSelect }) {
  const metrics = sessionMetrics(session)
  const exerciseLabel = metrics.exercises === 1 ? 'exercício' : 'exercícios'
  const setLabel = metrics.sets === 1 ? 'série' : 'séries'

  return (
    <Card
      as="article"
      hover={false}
      className="group h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover focus-within:-translate-y-0.5 focus-within:border-primary/30 focus-within:shadow-card-hover"
    >
      <button
        type="button"
        id={`history-session-${session.id}`}
        onClick={(event) => onSelect(session.id, event.currentTarget)}
        className="flex min-h-40 w-full items-center gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-6"
      >
        <span className="min-w-0 flex-1">
          <strong className="line-clamp-2 block text-lg font-semibold leading-snug tracking-tight text-slate-900 dark:text-white">
            {session.name}
          </strong>
          <small className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
            {workoutDateLabel(session.date)}
          </small>
          <span className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
            <span>{durationLabel(session.duration)}</span>
            <span>
              {numberLabel(metrics.exercises)} {exerciseLabel}{!metrics.reliability.exercises ? ' · parcial' : ''}
            </span>
            <span>
              {numberLabel(metrics.sets)} {setLabel}{!metrics.reliability.sets ? ' · parcial' : ''}
            </span>
          </span>
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors duration-200 group-hover:bg-primary-muted group-hover:text-primary group-focus-within:bg-primary-muted group-focus-within:text-primary dark:bg-white/[0.05] dark:text-slate-300 dark:group-hover:bg-primary/15 dark:group-hover:text-blue-300 dark:group-focus-within:bg-primary/15 dark:group-focus-within:text-blue-300">
          <ChevronRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5 group-focus-within:translate-x-0.5" aria-hidden="true" />
        </span>
      </button>
    </Card>
  )
}

export default function WorkoutHistory({ sessions, allSessions, onSelect }) {
  const hasHistory = allSessions.length > 0
  const hasRecentSessions = sessions.length > 0

  return (
    <section aria-labelledby="history-sessions-title">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="history-sessions-title" className={ui.sectionTitle}>Histórico de treinos</h2>
          <p className={ui.sectionSubtitle}>
            {hasRecentSessions
              ? 'Revise suas sessões concluídas e abra os detalhes do treino. Exibimos até os 12 treinos mais recentes.'
              : 'Revise suas sessões concluídas e abra os detalhes do treino.'}
          </p>
        </div>
        {hasRecentSessions ? (
          <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
            {numberLabel(sessions.length)} {sessions.length === 1 ? 'treino recente' : 'treinos recentes'}
          </span>
        ) : null}
      </div>

      {!sessions.length ? (
        <Card hover={false} className="px-6 py-10 text-center">
          <Dumbbell size={24} className="mx-auto text-slate-400" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            {hasHistory ? 'Nenhum treino nos últimos 30 dias.' : 'Seu histórico começa no próximo treino.'}
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {hasHistory
              ? 'Selecione Total para consultar sessões mais antigas.'
              : 'Finalize seu primeiro treino para começar a acompanhar sua evolução.'}
          </p>
          {!hasHistory ? (
            <Link to="/treinar" className={`${ui.btnPrimary} mt-6 min-h-11`}>
              Começar treino <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </Card>
      ) : (
        <ol className="grid gap-4 xl:grid-cols-2">
          {sessions.map((session) => (
            <li key={session.id} className="min-w-0">
              <WorkoutCard session={session} onSelect={onSelect} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
