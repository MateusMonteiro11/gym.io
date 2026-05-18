
/* Linha de informação individual */

function InfoRow({ label, valor, destaque = false }) {
  return (
    <div className="flex items-center justify-between py-2
                    border-b border-gray-50 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-semibold ${destaque ? 'text-primary' : 'text-slate-900'}`}>
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
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">
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