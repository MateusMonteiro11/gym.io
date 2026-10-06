import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import Button from '../ui/Button'
import CarouselNavigation from '../ui/CarouselNavigation'
import useHorizontalCarousel from '../../hooks/useHorizontalCarousel'
import WorkoutCard from './WorkoutCard'

const categories = [
  { id: 'usuario', label: 'Meus treinos', cardLabel: 'Personalizado' },
  { id: 'sistema', label: 'Sistema', cardLabel: 'Treino do sistema' },
]

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2'

export default function WorkoutCatalog({
  workouts,
  onStart,
  onViewWorkout,
  onManageWorkouts,
  initialSelection,
}) {
  const groupedWorkouts = useMemo(() => ({
    usuario: workouts.filter((workout) => workout.tipo === 'usuario'),
    sistema: workouts.filter((workout) => workout.tipo === 'sistema'),
  }), [workouts])
  const [category, setCategory] = useState(() => (
    categories.some((item) => item.id === initialSelection?.category)
      ? initialSelection.category
      : groupedWorkouts.usuario.length > 0 ? 'usuario' : 'sistema'
  ))
  const sectionRef = useRef(null)
  const tabRefs = useRef([])
  const restoreRef = useRef(initialSelection)
  const visibleWorkouts = groupedWorkouts[category]
  const currentCategory = categories.find((item) => item.id === category)
  const { railRef, navigation, scrollCards, updateNavigation } = useHorizontalCarousel(`${category}:${visibleWorkouts.map((workout) => workout.id_treino).join(',')}`)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) {
      const frame = requestAnimationFrame(() => {
        if (restoreRef.current) sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
        restoreRef.current = null
      })
      return () => cancelAnimationFrame(frame)
    }

    // Wait for layout; cancelling also keeps restoration safe under StrictMode.
    const frame = requestAnimationFrame(() => {
      const restoration = restoreRef.current
      restoreRef.current = null
      const restoredCard = restoration?.category === category
        ? [...rail.children].find((card) => card.dataset.workoutId === String(restoration.workoutId))
        : null
      const target = restoredCard || rail.firstElementChild
      rail.scrollTo({ left: target?.offsetLeft || 0, behavior: 'instant' })
      if (restoration) {
        sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
        target?.querySelector('[data-workout-preview]')?.focus({ preventScroll: true })
      }
      updateNavigation()
    })

    return () => cancelAnimationFrame(frame)
  }, [category, visibleWorkouts, railRef, updateNavigation])

  function handleTabKeyDown(event, index) {
    let nextIndex
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % categories.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + categories.length) % categories.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = categories.length - 1
    else return

    event.preventDefault()
    setCategory(categories[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <section ref={sectionRef} id="treinos-disponiveis" className="mt-16 min-w-0 scroll-mt-8 sm:mt-20" aria-labelledby="catalog-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-app-accent">Escolha livre</p>
          <h2 id="catalog-title" className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-app-ink sm:text-3xl">
            Treinos disponíveis
          </h2>
          <p className="mt-2 text-sm text-app-secondary">Comece agora, mesmo sem um agendamento.</p>
        </div>
        <button
          type="button"
          onClick={onManageWorkouts}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-app-accent transition-colors hover:bg-app-selection  ${focusRing}`}
        >
          Gerenciar
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Categorias de treinos" className="inline-flex max-w-full gap-1 rounded-2xl bg-app-muted/60 p-1">
          {categories.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => { tabRefs.current[index] = node }}
              type="button"
              role="tab"
              id={`catalog-tab-${item.id}`}
              aria-selected={category === item.id}
              aria-controls={`catalog-panel-${item.id}`}
              tabIndex={category === item.id ? 0 : -1}
              onClick={() => setCategory(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`inline-flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                category === item.id
                  ? 'bg-app-surface text-app-accent shadow-sm dark:hover:bg-app-line'
                  : 'text-app-secondary hover:bg-app-surface/60 dark:hover:bg-app-line dark:hover:text-app-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <CarouselNavigation navigation={navigation} onNavigate={scrollCards} controlsId={`catalog-panel-${category}`} />
      </div>

      {categories.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`catalog-panel-${item.id}`}
          aria-labelledby={`catalog-tab-${item.id}`}
          hidden={category !== item.id}
          tabIndex={0}
          className={`min-w-0 rounded-2xl ${focusRing}`}
        >
          {category === item.id && (visibleWorkouts.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-app-line px-5 py-10 text-center">
              <h3 className="text-lg font-semibold text-app-ink">
                {category === 'usuario' ? 'Nenhum treino personalizado ainda' : 'Nenhum treino do sistema disponível'}
              </h3>
              <p className="mt-2 text-sm text-app-secondary">
                {category === 'usuario'
                  ? 'Crie seu treino ou personalize um modelo na área de Treinos.'
                  : groupedWorkouts.usuario.length > 0
                    ? 'Seus treinos personalizados continuam na aba Meus treinos.'
                    : 'Use Gerenciar para criar seu primeiro treino.'}
              </p>
              {category === 'usuario' && (
                <Button variant="secondary" className="mt-6 min-h-11" onClick={onManageWorkouts}>Ir para Treinos</Button>
              )}
            </div>
          ) : (
            <div
              ref={railRef}
              className="training-rail relative grid auto-cols-[min(88%,20rem)] grid-flow-col items-stretch gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-1 p-1 pb-6 sm:auto-cols-[min(100%,20rem)] sm:gap-5"
              aria-label={`Treinos: ${currentCategory.label}`}
            >
              {visibleWorkouts.map((workout) => (
                <div key={workout.id_treino} data-workout-id={workout.id_treino} className="min-w-0 snap-start">
                  <WorkoutCard
                    compact
                    workout={workout}
                    eyebrow={currentCategory.cardLabel}
                    footer={(
                      <div className="grid gap-1">
                        <Button className="min-h-12 w-full rounded-2xl" onClick={() => onStart(workout)}>
                          <Play size={14} fill="currentColor" className="shrink-0" aria-hidden="true" />
                          Iniciar treino
                        </Button>
                        <button
                          type="button"
                          data-workout-preview
                          aria-label={`Visualizar treino: ${workout.nome || 'Treino'}`}
                          onClick={() => onViewWorkout(workout, { category, workoutId: workout.id_treino })}
                          className={`min-h-11 w-full rounded-xl px-2 py-2 text-sm font-semibold text-app-accent transition-colors hover:bg-app-selection  ${focusRing}`}
                        >
                          Visualizar treino
                        </button>
                      </div>
                    )}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
