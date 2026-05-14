export default function HistoricoHeader({ stats }) {
  const statCards = [
    { label: 'Total de treinos', value: stats?.totalTreinos || '0', icon: 'fa-dumbbell' },
    { label: 'Total de exercícios', value: stats?.totalExercicios || '0', icon: 'fa-fire' },
    { label: 'Dias semanais', value: stats?.diasSemanais || '0', icon: 'fa-calendar' },
    { label: 'Duração média', value: stats?.duracaoMedia || '0s', icon: 'fa-hourglass-end' },
  ]

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Histórico de Treinos</h1>
      <p className="text-gray-400 mb-6">Visualize o seu progresso ao longo do tempo</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400">{stat.label}</p>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className={`fa-solid ${stat.icon} text-blue-600`}></i>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
