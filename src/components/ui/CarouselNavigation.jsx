import { ArrowLeft, ArrowRight } from 'lucide-react'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2'

export default function CarouselNavigation({ navigation, onNavigate, controlsId, label = 'Navegação dos treinos' }) {
  return <div className="flex shrink-0 gap-2" aria-label={label}>
    {[-1, 1].map((direction) => <button
      key={direction}
      type="button"
      aria-label={direction < 0 ? 'Treino anterior' : 'Próximo treino'}
      aria-controls={controlsId}
      disabled={direction < 0 ? !navigation.previous : !navigation.next}
      onClick={() => onNavigate(direction)}
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-app-line bg-app-surface text-app-ink transition-colors hover:bg-app-muted disabled:cursor-default disabled:opacity-35 ${focusRing}`}
    >
      {direction < 0 ? <ArrowLeft size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
    </button>)}
  </div>
}
