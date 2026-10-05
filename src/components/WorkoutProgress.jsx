/**
 * @param {Object}  props
 * @param {number}  props.percentual - 0–100
 * @param {number}  props.exerciciosFeitos
 * @param {number}  props.totalExercicios
 * @param {number}  props.serieAtual
 * @param {number}  props.totalSeries - Séries do exercício atual
 */

export default function WorkoutProgress({
  percentual,
  exerciciosFeitos,
  totalExercicios,
  serieAtual,
  totalSeries,
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-app-line bg-app-surface p-5 dark:shadow-black/20">

      {/* Linha superior: label + contadores */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-app-secondary">
          Progresso
        </span>
        <div className="flex items-center gap-3 text-xs text-app-secondary">
          <span>
            Exercício{' '}
            <strong className="text-app-ink">{Math.min(exerciciosFeitos + 1, totalExercicios)}</strong>
            {' '}de{' '}
            <strong className="text-app-ink">{totalExercicios}</strong>
          </span>
          <span className="text-app-secondary">|</span>
          <span>
            Série{' '}
            <strong className="text-app-ink">{serieAtual}</strong>
            {' '}de{' '}
            <strong className="text-app-ink">{totalSeries}</strong>
          </span>
        </div>
      </div>

      {/* Barra principal */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-app-muted">
        <div
          className="absolute inset-y-0 left-0 bg-app-action rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  )
}
