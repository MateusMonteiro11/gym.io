import Button from '../ui/Button'
import WorkoutCard from './WorkoutCard'

export default function WorkoutCatalog({ workouts, onStart, onManageWorkouts }) {
  return (
    <section id="treinos-disponiveis" className="mt-16 scroll-mt-8 sm:mt-20" aria-labelledby="catalog-title">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
            Escolha livre
          </p>
          <h2 id="catalog-title" className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white sm:text-3xl">
            Treinos disponíveis
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Comece agora, mesmo sem um agendamento.
          </p>
        </div>

        <button
          type="button"
          onClick={onManageWorkouts}
          className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:hover:bg-[#101010] dark:focus-visible:ring-offset-black sm:inline-flex"
        >
          Gerenciar
          <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
        </button>
      </div>

      {workouts.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 px-6 py-10 text-center dark:border-white/[0.1]">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nenhum treino encontrado</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Crie seu primeiro treino para começar.</p>
          <Button variant="secondary" className="mt-6 min-h-11" onClick={onManageWorkouts}>
            Ir para Treinos
          </Button>
        </div>
      ) : (
        <div
          className="training-rail -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 sm:-mx-6 sm:gap-5 sm:px-6 lg:mx-0 lg:px-0"
          aria-label="Catálogo de treinos disponíveis"
        >
          {workouts.map((workout) => (
            <div key={workout.id_treino} className="min-w-[min(84vw,22rem)] snap-start sm:min-w-[22rem] lg:min-w-[23rem]">
              <WorkoutCard
                workout={workout}
                eyebrow="Disponível agora"
                footer={(
                  <Button className="min-h-12 w-full rounded-2xl" onClick={() => onStart(workout)}>
                    <i className="fa-solid fa-play text-xs text-white" aria-hidden="true" />
                    Iniciar treino
                  </Button>
                )}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onManageWorkouts}
        className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:hover:bg-[#101010] dark:focus-visible:ring-offset-black sm:hidden"
      >
        Gerenciar treinos
        <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
      </button>
    </section>
  )
}
