import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, MotionConfig, useReducedMotion } from 'framer-motion'
import { ArrowRight, Dumbbell } from 'lucide-react'

import Card from '../../components/ui/Card.jsx'
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
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [now, setNow] = useState(() => initialNow || new Date())
  const [trendMetric, setTrendMetric] = useState('workouts')
  const period = normalizePeriod(searchParams.get('period'))
  const workoutId = searchParams.get('workout')
  const exerciseId = searchParams.get('exercise')
  const view = exerciseId ? 'exercise' : workoutId ? 'workout' : 'overview'
  const listPosition = useRef({ scroll: 0, id: null })
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
  const trend = useMemo(() => buildHistoryBuckets(sessions, sets, period, now), [sessions, sets, period, now])
  const categoryDistribution = useMemo(() => getCategoryDistribution(visible, visibleSets), [visible, visibleSets])
  const featuredExercises = useMemo(() => getFeaturedExercises(visible, visibleSets), [visible, visibleSets])
  const loading = resources.sessions.status === 'loading' || resources.recentSessions.status === 'loading' || resources.sets.status === 'loading'
  const error = resources.sessions.status === 'error' || resources.recentSessions.status === 'error' || resources.sets.status === 'error'

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
      listPosition.current = { scroll: window.scrollY, id: button.id }
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

  function refresh() {
    resources.cache.clear()
    setNow(initialNow ? new Date(initialNow) : new Date())
    resources.retry()
    if (selected) detail.retry()
  }

  if (error) return <div className="history-page mx-auto max-w-6xl pb-16"><HistoryError onRetry={resources.retry} /></div>
  if (loading) return <div className="history-page mx-auto max-w-6xl pb-16"><HistorySkeleton /></div>
  if (view !== 'overview' && !selected) return <div className="history-page mx-auto max-w-6xl pb-16"><HistoryNotFound kind="workout" onBack={() => replaceWithParent('overview')} /></div>
  if (view === 'exercise' && detail.status === 'loading') return <div className="history-page mx-auto max-w-4xl pb-16"><HistorySkeleton detail /></div>
  if (view === 'exercise' && detail.status === 'error') return <div className="history-page mx-auto max-w-4xl pb-16"><HistoryError detail onRetry={detail.retry} /></div>
  if (view === 'exercise' && !exercise) return <div className="history-page mx-auto max-w-4xl pb-16"><HistoryNotFound kind="exercise" onBack={() => replaceWithParent('workout')} /></div>

  if (view === 'exercise') return <div className="history-page mx-auto max-w-4xl pb-16"><ExerciseProgression session={selected} exercise={exercise} sessions={visible} sets={visibleSets} onBack={() => goBack('workout')} onWorkoutSelect={(id, button) => openWorkout(id, button, 'exercise')} backRef={backRef} /></div>
  if (view === 'workout') return <div className="history-page mx-auto max-w-4xl pb-16"><WorkoutDetail session={selected} resource={detail} onBack={() => goBack(location.state?.historyParent === 'exercise' ? 'exercise' : 'overview')} backLabel={location.state?.historyParent === 'exercise' ? 'Voltar à evolução' : 'Voltar ao histórico'} onExercise={openExercise} backRef={backRef} /></div>

  const narrative = {
    hidden: { opacity: 1 },
    visible: { opacity: 1, transition: { staggerChildren: reduceMotion ? 0 : 0.055 } },
  }
  const chapter = reduceMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } } }

  if (!allSessions.length) return <MotionConfig reducedMotion="user"><motion.div className="history-page mx-auto max-w-6xl pb-16" variants={narrative} initial="hidden" animate="visible">
    <motion.div variants={chapter}><HistoryOverview stats={stats} period={period} onPeriodChange={changePeriod} onRefresh={refresh} demonstration={demonstration} /></motion.div>
    <motion.div variants={chapter}>
      <Card hover={false} className="mt-6 flex flex-col items-center px-6 py-12 text-center sm:py-14">
        <Dumbbell size={26} className="mx-auto text-slate-400" aria-hidden="true" />
        <div className="mt-5 flex w-full flex-col items-center gap-3 text-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Ainda não há treinos no seu histórico.</h2>
          <p className="w-full max-w-lg text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">Finalize seu primeiro treino para começar a acompanhar sua evolução.</p>
        </div>
        <Link to="/treinar" className={`${ui.btnPrimary} mt-8 min-h-11`}>Começar treino<ArrowRight size={16} aria-hidden="true" /></Link>
      </Card>
    </motion.div>
  </motion.div></MotionConfig>

  return <MotionConfig reducedMotion="user"><motion.div className="history-page mx-auto max-w-6xl pb-16" variants={narrative} initial="hidden" animate="visible">
    <motion.div variants={chapter}><HistoryOverview stats={stats} period={period} onPeriodChange={changePeriod} onRefresh={refresh} demonstration={demonstration} /></motion.div>
    <motion.div variants={chapter} className="mt-6 grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-5">
      <TrainingRhythm data={trend} metric={trendMetric} onMetricChange={setTrendMetric} />
      <MuscleDistribution distribution={categoryDistribution} />
    </motion.div>
    <motion.div variants={chapter} className="mt-16 sm:mt-20"><FeaturedExercises data={featuredExercises} /></motion.div>
    <motion.div variants={chapter} className="mt-16 sm:mt-20"><WorkoutHistory sessions={recentSessions} allSessions={allSessions} onSelect={openWorkout} /></motion.div>
  </motion.div></MotionConfig>
}
