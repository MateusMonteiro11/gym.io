import { useState } from 'react'
import { ArrowRight, Check, CircleHelp, Minus } from 'lucide-react'

import Card from '../../components/ui/Card.jsx'
import Disclosure from '../../components/ui/Disclosure.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { numberLabel, timeLabel } from './historyModel.js'

function setStatus(complete) {
  if (complete === true) return { className: 'is-complete', icon: Check, label: 'Concluída' }
  if (complete === false) return { className: 'is-incomplete', icon: Minus, label: 'Não concluída' }
  return { className: '', icon: CircleHelp, label: 'Não informado' }
}

function WorkoutSetItem({ set }) {
  const status = setStatus(set.complete)
  const StatusIcon = status.icon

  return <li className="history-workout-set-item">
    <strong className="history-workout-set-index">Série {numberLabel(set.series)}</strong>
    <span className="history-workout-set-value history-workout-set-weight">
      <small>Carga</small>
      <span>{numberLabel(set.weight, 2)}{set.weight != null && ' kg'}</span>
    </span>
    <span className="history-workout-set-value history-workout-set-reps">
      <small>Repetições</small>
      <span>{numberLabel(set.reps)}{set.reps != null && ' reps'}</span>
    </span>
    <span className={`history-set-status ${status.className}`}>
      <StatusIcon size={15} aria-hidden="true" />
      <span>{status.label}</span>
    </span>
  </li>
}

function WorkoutSetList({ exercise }) {
  return <ol className="history-workout-set-list" aria-label={`Séries de ${exercise.name}`}>
    {exercise.sets.map((set, index) => <WorkoutSetItem key={set.id ?? `${exercise.key}:set:${index}`} set={set} />)}
  </ol>
}

function WorkoutExerciseTimelineItem({ exercise, index, onExercise }) {
  const [open, setOpen] = useState(false)
  const headingId = `history-exercise-card-title-${index}`
  const setCount = `${exercise.sets.length} ${exercise.sets.length === 1 ? 'série' : 'séries'}`

  return <li className="history-exercise-timeline-item" data-expanded={open || undefined}>
    <span className="history-exercise-timeline-rail" aria-hidden="true" />
    <span className="history-exercise-timeline-node" aria-hidden="true">{index + 1}</span>
    <span className="history-exercise-timeline-connector" aria-hidden="true" />
    <Card as="article" hover={false} className="history-exercise-card" aria-labelledby={headingId}>
      <div className="history-exercise-card-header">
        <h3 id={headingId}>{exercise.name}</h3>
        <p>{setCount}{exercise.date && ` · ${timeLabel(exercise.date)}`}</p>
        <button
          type="button"
          id={`history-exercise-${exercise.exerciseId}-${index}`}
          className="history-exercise-evolution"
          onClick={(event) => onExercise(exercise.exerciseId, event.currentTarget)}
        >
          Ver evolução
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <Disclosure
        label="Ver detalhes das séries"
        openLabel="Ocultar detalhes das séries"
        open={open}
        onOpenChange={setOpen}
        className="history-exercise-disclosure"
        buttonClassName="history-exercise-disclosure-button"
        contentClassName="history-exercise-disclosure-content"
      >
        <WorkoutSetList exercise={exercise} />
      </Disclosure>
    </Card>
  </li>
}

export function WorkoutExerciseTimelineSkeleton() {
  return <div className="history-exercise-timeline history-exercise-timeline-skeleton" aria-hidden="true">
    {Array.from({ length: 3 }, (_, index) => <div className="history-exercise-timeline-item" key={index}>
      <span className="history-exercise-timeline-rail" />
      <span className="history-exercise-timeline-node" />
      <span className="history-exercise-timeline-connector" />
      <Card hover={false} className="history-exercise-card">
        <Skeleton className="h-4 w-2/3 rounded-full" />
        <Skeleton className="mt-3 h-3 w-28 rounded-full" />
        <Skeleton className="mt-5 h-11 w-full rounded-xl" />
      </Card>
    </div>)}
  </div>
}

export default function WorkoutExerciseTimeline({ exercises, onExercise }) {
  return <ol className="history-exercise-timeline">
    {exercises.map((exercise, index) => (
      <WorkoutExerciseTimelineItem
        exercise={exercise}
        index={index}
        key={exercise.key}
        onExercise={onExercise}
      />
    ))}
  </ol>
}
