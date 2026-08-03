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
  exerciciosRestantes,
  seriesRestantes,
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-slate-700/70 dark:bg-slate-900/85">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-300">
        Informações
      </p>

      <div>
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