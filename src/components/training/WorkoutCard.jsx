import { getWorkoutCounts } from '../../utils/trainingDiscovery'
import { isSystemWorkout, workoutColorStyle } from '../../utils/workoutColors.js'

export default function WorkoutCard({
  workout,
  eyebrow,
  actions,
  footer,
  prominent = false,
  compact = false,
  className = '',
}) {
  const { exerciseCount, sectionCount } = getWorkoutCounts(workout)
  const isSystem = isSystemWorkout(workout)

  return (
    <article
      style={workoutColorStyle(workout)}
      className={`relative flex flex-col overflow-hidden rounded-[1.75rem] border border-app-line/80  ${
        compact
          ? 'h-full min-w-0 bg-app-surface'
          : 'bg-app-surface shadow-[0_18px_50px_rgba(15,23,42,0.07)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.36)]'
      } ${prominent ? 'min-h-[21.5rem] sm:min-h-[23rem]' : compact ? '' : 'min-h-[17rem]'} ${className}`}
    >
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-app-line px-5 py-3 sm:px-6">
        <p className={`min-w-0 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] ${isSystem ? 'text-app-accent' : 'workout-color-label rounded-full border px-2 py-1'}`}>
          {eyebrow}
        </p>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <div className={`flex flex-1 flex-col px-5 py-6 sm:px-7 ${prominent ? 'sm:py-8' : ''}`}>
        <span className={`mb-5 h-1 w-10 rounded-full ${isSystem ? 'bg-app-action' : 'workout-color-bar'}`} aria-hidden="true" />
        <h3
          className={`font-semibold tracking-[-0.035em] text-app-ink  ${
            compact
              ? 'line-clamp-2 min-h-[2.4em] text-xl leading-[1.2] [overflow-wrap:anywhere] sm:text-2xl'
              : prominent ? 'max-w-[18ch] text-[clamp(2rem,8vw,3.25rem)] leading-[1.04]' : 'max-w-[18ch] text-2xl leading-[1.04] sm:text-[1.75rem]'
          }`}
        >
          {workout?.nome || 'Treino'}
        </h3>

        {!compact && workout?.descricao ? (
          <p className="mt-4 max-w-[58ch] text-sm leading-6 text-app-secondary">
            {workout.descricao}
          </p>
        ) : null}

        <p className={`mt-auto text-xs font-medium tracking-wide text-app-secondary  ${compact ? 'pt-5' : 'pt-8'}`}>
          {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'}
          <span className="mx-2 text-app-secondary" aria-hidden="true">/</span>
          {sectionCount} {sectionCount === 1 ? 'seção' : 'seções'}
        </p>
      </div>

      {footer ? (
        <div className={`border-t border-app-line p-4  sm:p-5 ${compact ? '' : 'bg-app-muted/70'}`}>
          {footer}
        </div>
      ) : null}
    </article>
  )
}
