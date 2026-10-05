/* Linha de informação individual */

function InfoRow({ label, valor, destaque = false }) {
  return (
    <div className="flex items-center justify-between border-b border-app-line py-2 last:border-0">
      <span className="text-sm text-app-secondary">{label}</span>
      <span className={`text-sm font-semibold ${destaque ? 'text-app-accent' : 'text-app-ink'}`}>
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
    <div className="rounded-2xl border border-app-line bg-app-surface p-5 shadow-sm shadow-slate-200/40 dark:shadow-none">
      <p className="text-xs font-semibold uppercase tracking-widest text-app-secondary">
        Informações
      </p>

      {nomeSecao && (
        <div className="mt-3 rounded-xl bg-app-muted p-3.5">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-action/10 text-xs font-bold text-app-accent">
              {ordemSecao || '•'}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-app-secondary">
                Seção atual
              </p>
              <h3 className="truncate text-sm font-bold text-app-ink">
                {nomeSecao}
              </h3>
              {descricaoSecao && (
                <p className="mt-0.5 text-xs leading-relaxed text-app-secondary">
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
