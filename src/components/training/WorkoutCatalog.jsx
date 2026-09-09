import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Play } from 'lucide-react'
import Button from '../ui/Button'
import WorkoutCard from './WorkoutCard'

const categories = [
  { id: 'usuario', label: 'Meus treinos', cardLabel: 'Personalizado' },
  { id: 'sistema', label: 'Sistema', cardLabel: 'Treino do sistema' },
]

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black'

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
  const [navigation, setNavigation] = useState({ previous: false, next: false })
  const railRef = useRef(null)
  const sectionRef = useRef(null)
  const tabRefs = useRef([])
  const restoreRef = useRef(initialSelection)
  const visibleWorkouts = groupedWorkouts[category]
  const currentCategory = categories.find((item) => item.id === category)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) {
      setNavigation({ previous: false, next: false })
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

    function updateNavigation() {
      const previous = rail.scrollLeft > 2
      const next = rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 2
      setNavigation((current) => (
        current.previous === previous && current.next === next ? current : { previous, next }
      ))
    }

    updateNavigation()
    rail.addEventListener('scroll', updateNavigation, { passive: true })
    const observer = new ResizeObserver(updateNavigation)
    observer.observe(rail)
    if (rail.firstElementChild) observer.observe(rail.firstElementChild)
    return () => {
      cancelAnimationFrame(frame)
      rail.removeEventListener('scroll', updateNavigation)
      observer.disconnect()
    }
  }, [category, visibleWorkouts])

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

  function scrollCards(direction) {
    const rail = railRef.current
    if (!rail?.firstElementChild) return
    const step = rail.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.scrollBy({ left: direction * step, behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  return (
    <section ref={sectionRef} id="treinos-disponiveis" className="mt-16 min-w-0 scroll-mt-8 sm:mt-20" aria-labelledby="catalog-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">Escolha livre</p>
          <h2 id="catalog-title" className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white sm:text-3xl">
            Treinos disponíveis
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Comece agora, mesmo sem um agendamento.</p>
        </div>
        <button
          type="button"
          onClick={onManageWorkouts}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-muted dark:hover:bg-[#101010] ${focusRing}`}
        >
          Gerenciar
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Categorias de treinos" className="inline-flex max-w-full gap-1 rounded-2xl bg-slate-200/60 p-1 dark:bg-white/[0.05]">
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
                  ? 'bg-white text-primary shadow-sm dark:bg-[#181818]'
                  : 'text-slate-600 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-white/[0.04]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2" aria-label="Navegação dos treinos">
          {[-1, 1].map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={direction < 0 ? 'Treino anterior' : 'Próximo treino'}
              aria-controls={`catalog-panel-${category}`}
              disabled={direction < 0 ? !navigation.previous : !navigation.next}
              onClick={() => scrollCards(direction)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-35 dark:border-white/[0.1] dark:bg-[#080808] dark:text-slate-200 dark:hover:bg-[#181818] ${focusRing}`}
            >
              {direction < 0 ? <ArrowLeft size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
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
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 px-5 py-10 text-center dark:border-white/[0.1]">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {category === 'usuario' ? 'Nenhum treino personalizado ainda' : 'Nenhum treino do sistema disponível'}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
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
                          className={`min-h-11 w-full rounded-xl px-2 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-muted dark:hover:bg-[#181818] ${focusRing}`}
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
