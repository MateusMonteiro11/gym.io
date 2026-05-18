import HistoricoCard from './HistoricoCard'

export default function HistoricoMonth({ mes, treinos }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-slate-900 mb-4 capitalize">
        {mes.charAt(0).toUpperCase() + mes.slice(1)}
      </h3>
      <div className="space-y-3">
        {treinos.map((treino) => (
          <HistoricoCard
            key={treino.id_historico}
            historico={treino}
          />
        ))}
      </div>
    </div>
  )
}
