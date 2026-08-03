import { ui } from '../styles/theme'

export default function HistoricoEmpty() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className={`${ui.emptyIcon} dark:bg-slate-800 dark:text-white`}>
        <i className="fa-solid fa-clock-rotate-left dark:text-white" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Nenhum treino registrado</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
        Complete seu primeiro treino para ver o histórico aqui.
      </p>
    </div>
  )
}
