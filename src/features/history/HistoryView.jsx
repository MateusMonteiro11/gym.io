import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ContentEntrance from '../../components/ui/ContentEntrance.jsx'
import { ArrowRight } from 'lucide-react'

import HistoryCard from './HistoryCard.jsx'
import { ui } from '../../styles/theme.js'
import FeaturedExercises from './FeaturedExercises.jsx'
import { ExerciseProgression, HistoryError, HistoryNotFound, HistorySkeleton, WorkoutDetail } from './HistoryDetail.jsx'
import HistoryOverview from './HistoryOverview.jsx'
import TrainingRhythm from './TrainingRhythm.jsx'
import MuscleDistribution from './MuscleDistribution.jsx'
import WorkoutHistory from './WorkoutHistory.jsx'
import { useHistoryData, useSessionDetail } from './useHistoryData.js'
import {
  buildOverview,
  buildHistoryBuckets,
  getCategoryDistribution,
  getFeaturedExercises,
  groupExercises,
  normalizePeriod,
  periodSessions,
} from './historyModel.js'
import { canonicalHistoryParams, exerciseHistoryParams, parentHistoryParams, periodHistoryParams, workoutHistoryParams } from './historyNavigation.js'
import './history.css'

export default function HistoryView({ userId, repository, initialNow, demonstration = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [now] = useState(() => initialNow || new Date())
  const [trendMetric, setTrendMetric] = useState('workouts')
  const [exerciseRankingMode, setExerciseRankingMode] = useState('load')
  const period = normalizePeriod(searchParams.get('period'))
  const workoutId = searchParams.get('workout')
  const exerciseId = searchParams.get('exercise')
  const view = exerciseId ? 'exercise' : workoutId ? 'workout' : 'overview'
  const listPosition = useRef({ scroll: 0, id: null, horizontal: 0 })
  const exercisePosition = useRef({ scroll: 0, id: null })
  const progressionPosition = useRef({ scroll: 0, id: null })
  const openingWorkoutFromExercise = useRef(false)
  const backRef = useRef(null)
  const previousView = useRef(view)

  const resources = useHistoryData(repository, userId, period, now)
  const sessions = resources.sessions.data
  const recentSessions = resources.recentSessions.data
  const sets = resources.sets.data
  const allSessions = useMemo(() => periodSessions(sessions, 'all', now), [sessions, now])
  const visible = useMemo(() => periodSessions(sessions, period, now), [sessions, period, now])
  const visibleIds = useMemo(() => new Set(visible.map((session) => session.id)), [visible])
  const visibleSets = useMemo(() => sets.filter((set) => visibleIds.has(set.sessionId)), [sets, visibleIds])
  const selected = recentSessions.find((item) => item.id === workoutId)
    || sessions.find((item) => item.id === workoutId)
    || null
  const detail = useSessionDetail(repository, userId, selected?.id || null, resources.cache)
  const detailGroups = useMemo(() => selected && detail.status === 'ready' ? groupExercises(detail.data, selected) : [], [detail.data, detail.status, selected])
  const exercise = detailGroups.find((group) => group.exerciseId === exerciseId) || null
  const stats = useMemo(() => buildOverview(sessions, sets, period, now), [sessions, sets, period, now])
  const trend = useMemo(() => period === 'all' ? [] : buildHistoryBuckets(sessions, sets, period, now), [sessions, sets, period, now])
  const categoryDistribution = useMemo(() => getCategoryDistribution(visible, visibleSets), [visible, visibleSets])
  const featuredExercises = useMemo(() => getFeaturedExercises(visible, visibleSets), [visible, visibleSets])
  const loading = resources.sessions.status === 'loading' || resources.recentSessions.status === 'loading' || resources.sets.status === 'loading'
  const error = resources.sessions.status === 'error' || resources.recentSessions.status === 'error' || resources.sets.status === 'error'
  const resourceError = [resources.sessions, resources.recentSessions, resources.sets].find((resource) => resource.error?.code === 'HISTORY_VOLUME_LIMIT')?.error

  useEffect(() => {
    if (searchParams.get('period') !== period) setSearchParams(canonicalHistoryParams(searchParams), { replace: true })
  }, [period, searchParams, setSearchParams])

  useEffect(() => {
    const from = previousView.current
    if (view === 'overview' && from === 'workout') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: listPosition.current.scroll, behavior: 'auto' })
        document.getElementById(listPosition.current.id)?.focus({ preventScroll: true })
      })
    }
    if (view === 'workout' && from === 'exercise') {
      const openingRecentSession = openingWorkoutFromExercise.current
      openingWorkoutFromExercise.current = false
      requestAnimationFrame(() => {
        if (openingRecentSession) {
          window.scrollTo({ top: 0, behavior: 'auto' })
          backRef.current?.focus({ preventScroll: true })
          return
        }
        window.scrollTo({ top: exercisePosition.current.scroll, behavior: 'auto' })
        document.getElementById(exercisePosition.current.id)?.focus({ preventScroll: true })
      })
    }
    if (view === 'exercise') {
      const returnTarget = progressionPosition.current
      progressionPosition.current = { scroll: 0, id: null }
      requestAnimationFrame(() => {
        if (returnTarget.id) {
          window.scrollTo({ top: returnTarget.scroll, behavior: 'auto' })
          document.getElementById(returnTarget.id)?.focus({ preventScroll: true })
          return
        }
        window.scrollTo({ top: 0, behavior: 'auto' })
        backRef.current?.focus({ preventScroll: true })
      })
    }
    if (view === 'workout' && from === 'overview') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'auto' })
        backRef.current?.focus({ preventScroll: true })
      })
    }
    previousView.current = view
  }, [view])

  function changePeriod(nextPeriod) {
    setSearchParams(periodHistoryParams(nextPeriod), { replace: true })
  }

  function openWorkout(id, button, parent = 'overview') {
    if (button && parent === 'exercise') {
      progressionPosition.current = { scroll: window.scrollY, id: button.id }
      openingWorkoutFromExercise.current = true
    } else if (button) {
      listPosition.current = { scroll: window.scrollY, id: button.id, horizontal: button.closest('#history-recent-rail')?.scrollLeft || 0 }
    }
    const next = workoutHistoryParams(searchParams, period, id)
    navigate({ pathname: location.pathname, search: `?${next}` }, { state: { historyParent: parent } })
  }

  function openExercise(id, button) {
    exercisePosition.current = { scroll: window.scrollY, id: button?.id || `history-exercise-${id}` }
    const next = exerciseHistoryParams(searchParams, id)
    navigate({ pathname: location.pathname, search: `?${next}` }, { state: { historyParent: 'workout' } })
  }

  function replaceWithParent(parent) {
    const next = parentHistoryParams(searchParams, parent)
    navigate({ pathname: location.pathname, search: `?${next}` }, { replace: true })
  }

  function goBack(parent) {
    if (location.state?.historyParent === parent) navigate(-1)
    else replaceWithParent(parent)
  }

  if (error) return <div className="history-page mx-auto max-w-6xl pb-16"><HistoryError error={resourceError} onRetry={resources.retry} onNarrow={period === 'all' ? () => changePeriod('30d') : undefined} /></div>
  if (loading) return <div className="history-page mx-auto max-w-6xl pb-16"><HistorySkeleton /></div>
  if (view !== 'overview' && !selected) return <div className="history-page mx-auto max-w-6xl pb-16"><HistoryNotFound kind="workout" onBack={() => replaceWithParent('overview')} /></div>
  if (view === 'exercise' && detail.status === 'loading') return <div className="history-page mx-auto max-w-4xl pb-16"><HistorySkeleton detail /></div>
  if (view === 'exercise' && detail.status === 'error') return <div className="history-page mx-auto max-w-4xl pb-16"><HistoryError detail error={detail.error} onRetry={detail.retry} /></div>
  if (view === 'exercise' && !exercise) return <div className="history-page mx-auto max-w-4xl pb-16"><HistoryNotFound kind="exercise" onBack={() => replaceWithParent('workout')} /></div>

  if (view === 'exercise') return <div className="history-page mx-auto max-w-4xl pb-16"><ExerciseProgression session={selected} exercise={exercise} sessions={visible} sets={visibleSets} period={period} onBack={() => goBack('workout')} onWorkoutSelect={(id, button) => openWorkout(id, button, 'exercise')} backRef={backRef} /></div>
  if (view === 'workout') return <div className="history-page mx-auto max-w-4xl pb-16"><WorkoutDetail session={selected} resource={detail} onBack={() => goBack(location.state?.historyParent === 'exercise' ? 'exercise' : 'overview')} backLabel={location.state?.historyParent === 'exercise' ? 'Voltar à evolução' : 'Voltar ao histórico'} onExercise={openExercise} backRef={backRef} /></div>

  if (!allSessions.length && !recentSessions.length) return <div className="history-page mx-auto max-w-6xl pb-16">
    <ContentEntrance><HistoryOverview stats={stats} period={period} onPeriodChange={changePeriod} demonstration={demonstration} /></ContentEntrance>
    <ContentEntrance index={1}>
      <HistoryCard className="history-onboarding mt-6 flex flex-col items-center text-center">
        <div className="flex w-full flex-col items-center gap-3 text-center">
          <h2 className="text-xl font-semibold text-app-ink">Ainda não há treinos no seu histórico.</h2>
          <p className="w-full max-w-lg text-center text-sm leading-relaxed text-app-secondary">Finalize seu primeiro treino para começar a acompanhar sua evolução.</p>
        </div>
        <Link to="/treinar" className={`${ui.btnPrimary} mt-8 min-h-11`}>Começar treino<ArrowRight size={16} aria-hidden="true" /></Link>
      </HistoryCard>
    </ContentEntrance>
  </div>

  return <div className="history-page mx-auto max-w-6xl pb-16">
    <ContentEntrance><HistoryOverview stats={stats} period={period} onPeriodChange={changePeriod} demonstration={demonstration} /></ContentEntrance>
    <ContentEntrance index={1} className="history-feature-grid history-section">
      <FeaturedExercises data={featuredExercises} mode={exerciseRankingMode} onModeChange={setExerciseRankingMode} />
      <MuscleDistribution distribution={categoryDistribution} />
    </ContentEntrance>
    <ContentEntrance index={2} className="history-section">
      {period === 'all' ? <HistoryCard as="section" className="history-rhythm-notice" aria-labelledby="history-rhythm-notice-title">
        <div><h2 id="history-rhythm-notice-title" className={ui.sectionTitle}>Ritmo de treino</h2>
          <p className={ui.sectionSubtitle}>Disponível no Mensal para manter o gráfico legível e o carregamento leve. Os demais indicadores continuam no período Total.</p></div>
        <button type="button" className="history-button" onClick={() => changePeriod('30d')}>Ver ritmo mensal<ArrowRight size={16} aria-hidden="true" /></button>
      </HistoryCard> : <TrainingRhythm data={trend} metric={trendMetric} onMetricChange={setTrendMetric} />}
    </ContentEntrance>
    <ContentEntrance index={3} className="history-section"><WorkoutHistory sessions={recentSessions} allSessions={allSessions} onSelect={openWorkout} initialScrollLeft={listPosition.current.horizontal} /></ContentEntrance>
  </div>
}
