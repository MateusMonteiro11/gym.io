import { getWorkoutCounts } from '../../utils/trainingDiscovery'

export default function WorkoutCard({
  workout,
  eyebrow,
  actions,
  footer,
  prominent = false,
  className = '',
}) {
  const { exerciseCount, sectionCount } = getWorkoutCounts(workout)

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)] dark:border-white/[0.06] dark:bg-[#080808] dark:shadow-[0_24px_60px_rgba(0,0,0,0.36)] ${
        prominent ? 'min-h-[21.5rem] sm:min-h-[23rem]' : 'min-h-[17rem]'
      } ${className}`}
    >
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-100 px-5 py-3 dark:border-white/[0.06] sm:px-6">
        <p className="min-w-0 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <div className={`flex flex-1 flex-col px-5 py-6 sm:px-7 ${prominent ? 'sm:py-8' : ''}`}>
        <span className="mb-5 h-1 w-10 rounded-full bg-primary" aria-hidden="true" />
        <h3
          className={`max-w-[18ch] font-semibold leading-[1.04] tracking-[-0.035em] text-slate-950 dark:text-white ${
            prominent ? 'text-[clamp(2rem,8vw,3.25rem)]' : 'text-2xl sm:text-[1.75rem]'
          }`}
        >
          {workout?.nome || 'Treino'}
        </h3>

        {workout?.descricao ? (
          <p className="mt-4 max-w-[58ch] text-sm leading-6 text-slate-600 dark:text-slate-300">
            {workout.descricao}
          </p>
        ) : null}

        <p className="mt-auto pt-8 text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
          {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'}
          <span className="mx-2 text-slate-300 dark:text-slate-700" aria-hidden="true">/</span>
          {sectionCount} {sectionCount === 1 ? 'seção' : 'seções'}
        </p>
      </div>

      {footer ? (
        <div className="border-t border-slate-100 bg-slate-50/70 p-4 dark:border-white/[0.06] dark:bg-[#050505] sm:p-5">
          {footer}
        </div>
      ) : null}
    </article>
  )
}
