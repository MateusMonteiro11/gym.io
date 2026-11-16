import { memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getWorkoutCounts } from '../../utils/trainingDiscovery.js'
import { workoutColorStyle } from '../../utils/workoutColors.js'

function WorkoutLibraryCard({
  workout,
  preview = false,
  showActions = false,
  isSystem = false,
  viewPath,
  editPath,
  onAgendar,
  onDelete,
}) {
  const navigate = useNavigate()
  const { exerciseCount, sectionCount } = getWorkoutCounts(workout)
  const typeLabel = isSystem ? 'Sistema' : 'Personalizado'

  return (
    <article style={workoutColorStyle(workout)} aria-label={preview ? "Prévia do treino" : undefined} className={`workout-library-card group relative isolate flex pt-2 ${preview ? "min-h-[17rem]" : "min-h-[24.5rem]"}`}>
      <span
        aria-hidden="true"
        className={`workout-library-card__layer pointer-events-none absolute inset-x-3 bottom-0 top-0 rounded-[1.75rem] ${
          isSystem
            ? 'bg-app-action/15'
            : 'workout-color-layer'
        }`}
      />

      <div className={`workout-library-card__surface relative z-10 flex flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-app-line/80 bg-app-surface ${preview ? "min-h-64" : "min-h-96"}`}>
        <div className="workout-library-card__header flex shrink-0 gap-2 px-4 py-4">
          <span
            className={`inline-flex min-h-7 items-center rounded-full border px-2 text-[0.625rem] font-semibold uppercase tracking-[0.08em] ${
              isSystem
                ? 'border-app-accent/20 bg-app-action/10 text-app-accent'
                : 'workout-color-label'
            }`}
          >
            {typeLabel}
          </span>

          {showActions && editPath && !isSystem ? (
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={`Ações de ${workout.nome}`}
            >
              <button
                type="button"
                onClick={() => navigate(editPath)}
                title="Editar treino"
                aria-label={`Editar ${workout.nome}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-app-line text-app-secondary hover:border-app-accent/30 hover:bg-app-action/10 hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 ring-offset-app-canvas"
              >
                <i className="fa-solid fa-pen text-xs" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(workout)}
                title="Excluir treino"
                aria-label={`Excluir ${workout.nome}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-app-danger text-app-danger hover:bg-app-danger-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-danger focus-visible:ring-offset-2 ring-offset-app-canvas"
              >
                <i className="fa-solid fa-trash-can text-xs" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:pb-6">
          <span className={`workout-library-card__accent mb-5 h-1 w-10 rounded-full ${isSystem ? 'bg-app-action' : 'workout-color-bar'}`} aria-hidden="true" />

          <h3 className={`line-clamp-2 break-words font-semibold tracking-[-0.035em] text-app-ink ${preview ? 'text-xl leading-[1.1]' : 'text-[1.65rem] leading-[1.05] sm:text-[1.8rem]'}`}>
            {workout.nome || 'Nome do treino'}
          </h3>
          <p className="mt-4 line-clamp-2 min-h-12 text-sm leading-6 text-app-secondary">
            {workout.descricao || 'Sem descrição'}
          </p>

          <p className="mt-6 text-[0.6875rem] font-medium text-app-secondary">
            {sectionCount} {sectionCount === 1 ? 'seção' : 'seções'}
            <span className="mx-2 text-app-secondary" aria-hidden="true">/</span>
            {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'}
          </p>

          {!preview && (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-8">
            <Link
              to={viewPath}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-app-ink hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 ring-offset-app-canvas"
            >
              Visualizar
              <i className="workout-library-card__arrow fa-solid fa-arrow-right text-xs text-app-accent" aria-hidden="true" />
            </Link>

            {onAgendar ? (
              <button
                type="button"
                onClick={() => onAgendar(workout)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-app-action px-3 py-2 text-sm font-semibold text-white hover:bg-app-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 ring-offset-app-canvas"
              >
                <i className="fa-solid fa-calendar-plus text-xs" aria-hidden="true" />
                Agendar
              </button>
            ) : null}
          </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default memo(WorkoutLibraryCard)
