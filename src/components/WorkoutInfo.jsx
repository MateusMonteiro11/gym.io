/* Linha de informação individual */

function InfoRow({ label, valor, destaque = false }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 py-2 last:border-0 dark:border-slate-700/70">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className={`text-sm font-semibold ${destaque ? 'text-primary dark:text-white' : 'text-slate-900 dark:text-slate-50'}`}>
        {valor}
      </span>
    </div>
  )
}

/**
 * @param {Object}  props
 * @param {number}  props.exerciciosRestantes
 * @param {number}  props.seriesRestantes
 */

export default function WorkoutInfo({
  nomeSecao,
  descricaoSecao,
  ordemSecao,
  exerciciosRestantes,
  seriesRestantes,
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-slate-200/40 dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-none">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Informações
      </p>

      {nomeSecao && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/80">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary dark:bg-primary/20 dark:text-blue-200">
              {ordemSecao || '•'}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Seção atual
              </p>
              <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
                {nomeSecao}
              </h3>
              {descricaoSecao && (
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {descricaoSecao}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3">
        <InfoRow
          label="Exercícios restantes"
          valor={exerciciosRestantes === 0 ? 'Último!' : exerciciosRestantes}
          destaque={exerciciosRestantes === 0}
        />
        <InfoRow
          label="Séries restantes"
          valor={seriesRestantes}
        />
      </div>
    </div>
  )
}
