import { ArrowLeft, ArrowRight, Dumbbell, RotateCcw, TriangleAlert } from 'lucide-react'

import Card from '../../components/ui/Card.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ExerciseTrendChart } from './HistoryCharts.jsx'
import { buildEvolution, durationLabel, evolutionInsight, exerciseSummary, groupExercises, numberLabel, sessionMetrics, shortDate, timeLabel } from './historyModel.js'
import WorkoutExerciseTimeline, { WorkoutExerciseTimelineSkeleton } from './WorkoutExerciseTimeline.jsx'

export function HistoryError({ detail = false, onRetry }) {
  return <div className="history-state history-error" role="alert"><TriangleAlert size={26} aria-hidden="true" /><h2>{detail ? 'Não foi possível abrir este treino' : 'Não foi possível carregar o histórico'}</h2><p>Seus registros continuam salvos. Tente carregar novamente.</p><button type="button" className="history-button" onClick={onRetry}><RotateCcw size={16} aria-hidden="true" />Tentar novamente</button></div>
}

export function HistorySkeleton({ detail = false, embedded = false }) {
  if (detail) return <div className="space-y-5" role="status" aria-busy="true">
    <span className="history-sr-only">Carregando detalhes do treino</span>
    {!embedded && <>
      <Skeleton className="h-11 w-40 rounded-xl" />
      <Skeleton className="h-8 w-3/5 rounded-xl" />
    </>}
    <Card hover={false} className="grid grid-cols-3 gap-3 p-3 sm:p-5">
      {Array.from({ length: 3 }, (_, index) => <div className="min-w-0 py-2" key={index}>
        <Skeleton className="h-3 w-14 max-w-full rounded-full" />
        <Skeleton className="mt-3 h-7 w-16 max-w-full rounded-lg" />
      </div>)}
    </Card>
    <Skeleton className="h-6 w-52 rounded-lg" />
    <WorkoutExerciseTimelineSkeleton />
  </div>

  return <div className="space-y-6" role="status" aria-busy="true">
    <span className="history-sr-only">Carregando histórico</span>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Skeleton className="h-9 w-40 rounded-xl" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full rounded-full" />
      </div>
      <Skeleton className="h-11 w-52 max-w-full self-end rounded-2xl" />
    </div>
    <Card hover={false} className="p-6 sm:p-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="rounded-xl bg-primary-muted p-3 dark:bg-primary/10 sm:p-4">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="mt-3 h-8 w-20 rounded-lg" />
        </div>)}
      </div>
    </Card>
    <div className="grid items-start gap-6 xl:grid-cols-5">
      <Card hover={false} className="min-h-80 p-6 xl:col-span-3"><Skeleton className="h-6 w-40 rounded-lg" /><Skeleton className="mt-3 h-3 w-64 max-w-full rounded-full" /><Skeleton className="mt-8 h-52 w-full rounded-xl" /></Card>
      <Card hover={false} className="min-h-80 p-6 xl:col-span-2"><Skeleton className="h-6 w-48 rounded-lg" /><Skeleton className="mt-3 h-3 w-56 max-w-full rounded-full" /><Skeleton className="mt-8 h-44 w-full rounded-xl" /></Card>
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      {Array.from({ length: 2 }, (_, index) => <Card hover={false} className="p-4 sm:p-6" key={index}><Skeleton className="h-6 w-44 rounded-lg" /><Skeleton className="mt-6 h-44 w-full rounded-xl" /></Card>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => <Card hover={false} className="min-h-40 p-6" key={index}><Skeleton className="h-5 w-1/2 rounded-lg" /><Skeleton className="mt-3 h-3 w-2/3 rounded-full" /><Skeleton className="mt-8 h-4 w-full rounded-full" /></Card>)}
    </div>
  </div>
}

export function HistoryNotFound({ kind = 'workout', onBack }) {
  const backLabel = kind === 'exercise' ? 'Voltar ao treino' : 'Voltar ao histórico'
  return <section className="history-drill-view"><button type="button" className="history-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />{backLabel}</button><div className="history-state"><Dumbbell size={26} aria-hidden="true" /><h1>Registro não encontrado</h1><p>{kind === 'exercise' ? 'Este exercício não está disponível no treino selecionado.' : 'Este treino não está disponível no seu histórico.'}</p><button type="button" className="history-button history-button-primary" onClick={onBack}>{backLabel}</button></div></section>
}

function MetricItem({ label, value, note }) {
  return <div><dt>{label}</dt><dd>{value}</dd>{note && <small>{note}</small>}</div>
}

export function WorkoutDetail({ session, resource, onBack, backLabel = 'Voltar ao histórico', onExercise, backRef }) {
  const groups = session && resource.status === 'ready' ? groupExercises(resource.data, session) : []
  const metrics = session ? sessionMetrics(session, resource.data) : null
  return <section className="history-drill-view" aria-labelledby="history-detail-title">
    <button type="button" className="history-back" onClick={onBack} ref={backRef}><ArrowLeft size={17} aria-hidden="true" />{backLabel}</button>
    <div className="history-detail-heading">
      <p>{session?.date ? `${session.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${timeLabel(session.date)}` : 'Data não registrada'}</p>
      <h1 id="history-detail-title">{session?.name || 'Treino registrado'}</h1>
    </div>
    {resource.status === 'loading' ? <HistorySkeleton detail embedded /> : resource.status === 'error' ? <HistoryError detail onRetry={resource.retry} /> : <>
      <Card hover={false} className="history-detail-summary-card">
        <dl className="history-detail-metrics">
          <MetricItem label="Duração" value={durationLabel(session.duration)} />
          <MetricItem label="Séries" value={numberLabel(metrics.sets)} note={!metrics.reliability.sets ? 'parcial' : null} />
          <MetricItem label="Exercícios" value={numberLabel(metrics.exercises)} note={!metrics.reliability.exercises ? 'parcial' : null} />
        </dl>
      </Card>
      {!groups.length ? <div className="history-state"><p>Os detalhes das séries não estão disponíveis neste registro.</p></div> : <>
        {!session.recordingSessionId && <p className="history-data-note">Registro antigo: exercícios em ordem estável. A sequência e os horários de execução não foram registrados.</p>}
        <div className="history-detail-section-heading"><h2>Exercícios realizados</h2><span>{groups.length} {groups.length === 1 ? 'exercício' : 'exercícios'}</span></div>
        <WorkoutExerciseTimeline exercises={groups} onExercise={onExercise} />
      </>}
      <p className="history-detail-footnote">O tempo inclui os descansos da sessão. “—” indica informação não registrada.</p>
    </>}
  </section>
}

export function ExerciseProgression({ session, exercise, sessions, sets, onBack, onWorkoutSelect, backRef }) {
  const points = buildEvolution(sessions, sets, exercise.exerciseId)
  const summary = exerciseSummary(sessions, sets, exercise.exerciseId)
  const recent = [...points].filter((point) => point.value != null).reverse().slice(0, 8)

  return <section className="history-drill-view" aria-labelledby="history-exercise-title">
    <button type="button" className="history-back" onClick={onBack} ref={backRef}><ArrowLeft size={17} aria-hidden="true" />Voltar ao treino</button>
    <div className="history-detail-heading"><p>{session.name}</p><h1 id="history-exercise-title">{exercise.name}</h1></div>
    <Card hover={false} className="history-detail-summary-card">
      <dl className="history-exercise-summary">
        <MetricItem label="Última carga" value={summary.latest ? `${numberLabel(summary.latest.value, 2)} kg` : '—'} note={summary.latest?.reps != null ? `${numberLabel(summary.latest.reps)} rep` : null} />
        <MetricItem label="Melhor carga" value={summary.best ? `${numberLabel(summary.best.value, 2)} kg` : '—'} note={summary.best ? shortDate(new Date(summary.best.timestamp)) : null} />
        <MetricItem label="Variação no período" value={summary.variation == null ? '—' : `${summary.variation > 0 ? '+' : ''}${numberLabel(summary.variation, 1)}%`} note={summary.reliable ? 'primeiro × último' : 'dados insuficientes'} />
      </dl>
    </Card>
    <Card hover={false} className="history-progression-chart">
      <div className="history-progression-heading"><div><h2>Progressão registrada</h2><p>Maior carga concluída em cada sessão deste exercício.</p></div></div>
      <ExerciseTrendChart points={points} />
      <p className="history-insight">{evolutionInsight(points)}</p>
    </Card>
    <div className="history-progress-sessions"><div className="history-detail-section-heading"><h2>Sessões recentes</h2><span>{recent.length} registros</span></div>{recent.length ? <ol>{recent.map((point) => <li key={point.sessionId}><button type="button" id={`history-progression-session-${point.sessionId}`} onClick={(event) => onWorkoutSelect(point.sessionId, event.currentTarget)}><span><strong>{point.name}</strong><small>{shortDate(new Date(point.timestamp))} · {timeLabel(new Date(point.timestamp))}</small></span><span><strong>{numberLabel(point.value, 2)} kg</strong>{point.reps != null && <small>{numberLabel(point.reps)} rep</small>}</span><ArrowRight size={16} aria-hidden="true" /></button></li>)}</ol> : <div className="history-state"><p>Nenhuma sessão com carga registrada no período.</p></div>}</div>
  </section>
}
