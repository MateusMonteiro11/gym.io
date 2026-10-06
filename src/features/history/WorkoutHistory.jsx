import { ArrowRight, ArrowUpRight, Dumbbell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLayoutEffect } from 'react'
import CarouselNavigation from '../../components/ui/CarouselNavigation.jsx'
import useHorizontalCarousel from '../../hooks/useHorizontalCarousel.js'
import HistoryMetricValue from './HistoryMetricValue.jsx'

import HistoryCard from './HistoryCard.jsx'
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

function WorkoutCard({ session, index, onSelect }) {
  const metrics = sessionMetrics(session)
  const exerciseLabel = metrics.exercises === 1 ? 'exercício' : 'exercícios'
  const setLabel = metrics.sets === 1 ? 'série' : 'séries'

  return (
    <HistoryCard
      as="article"
      density="compact"
      tone={index % 2 === 1 ? 'accent' : 'neutral'}
      className="history-workout-card"
    >
      <button
        type="button"
        id={`history-session-${session.id}`}
        onClick={(event) => onSelect(session.id, event.currentTarget)}
        className="history-workout-button"
      >
        <span className="history-workout-top">
          <span className="history-workout-date">{workoutDateLabel(session.date)}</span>
          <span className="history-workout-arrow"><ArrowUpRight size={22} aria-hidden="true" /></span>
        </span>
        <span className="history-workout-base">
          <strong className="history-workout-name">
            {session.name}
          </strong>
          <HistoryMetricValue className="history-workout-duration" value={durationLabel(session.duration)} />
          <span className="history-workout-metadata">
            <span>
              {numberLabel(metrics.exercises)} {exerciseLabel}{!metrics.reliability.exercises ? ' · parcial' : ''}
            </span>
            <span>
              {numberLabel(metrics.sets)} {setLabel}{!metrics.reliability.sets ? ' · parcial' : ''}
            </span>
          </span>
          <span className="history-workout-cta">Ver treino</span>
        </span>
      </button>
    </HistoryCard>
  )
}

export default function WorkoutHistory({ sessions, allSessions, onSelect, initialScrollLeft = 0 }) {
  const hasHistory = allSessions.length > 0
  const hasRecentSessions = sessions.length > 0
  const itemsKey = sessions.map((session) => session.id).join(',')
  const { railRef, navigation, scrollCards, updateNavigation } = useHorizontalCarousel(itemsKey)
  useLayoutEffect(() => {
    railRef.current?.scrollTo({ left: initialScrollLeft, behavior: 'instant' })
    updateNavigation()
  }, [itemsKey, initialScrollLeft, railRef, updateNavigation])

  return (
    <section aria-labelledby="history-sessions-title">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="history-sessions-title" className={ui.sectionTitle}>Histórico de treinos</h2>
          <p className={ui.sectionSubtitle}>
            {hasRecentSessions
              ? 'Até 12 treinos recentes, independentemente do período da análise. Abra uma sessão para ver os detalhes.'
              : 'Revise suas sessões concluídas e abra os detalhes do treino.'}
          </p>
        </div>
        {hasRecentSessions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-4"><span className="text-sm text-app-secondary">
            {numberLabel(sessions.length)} {sessions.length === 1 ? 'treino recente' : 'treinos recentes'}
          </span><CarouselNavigation navigation={navigation} onNavigate={scrollCards} controlsId="history-recent-rail" label="Navegação dos treinos recentes" /></div>
        ) : null}
      </div>

      {!sessions.length ? (
        <HistoryCard className="history-onboarding text-center">
          <Dumbbell size={24} className="mx-auto text-app-secondary" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-app-ink">
            {hasHistory ? 'Nenhum treino recente disponível.' : 'Seu histórico começa no próximo treino.'}
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-app-secondary">
            {hasHistory
              ? 'Atualize o histórico para tentar carregar suas sessões novamente.'
              : 'Finalize seu primeiro treino para começar a acompanhar sua evolução.'}
          </p>
          {!hasHistory ? (
            <Link to="/treinar" className={`${ui.btnPrimary} mt-6 min-h-11`}>
              Começar treino <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </HistoryCard>
      ) : (
        <ol ref={railRef} id="history-recent-rail" className="training-rail history-workout-rail" role="list" aria-label="Treinos recentes">
          {sessions.map((session, index) => (
            <li key={session.id} className="min-w-0">
              <WorkoutCard session={session} index={index} onSelect={onSelect} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
