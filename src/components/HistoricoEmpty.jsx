import { ui } from '../styles/theme'

export default function HistoricoEmpty() {
  return (
    <div className="rounded-2xl border border-dashed border-app-line bg-app-surface py-16 text-center">
      <div className={`${ui.emptyIcon}  `}>
        <i className="fa-solid fa-clock-rotate-left" />
      </div>
      <h3 className="text-lg font-semibold text-app-ink">Nenhum treino registrado</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-app-secondary">
        Complete seu primeiro treino para ver o histórico aqui.
      </p>
    </div>
  )
}
