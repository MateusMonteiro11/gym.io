import Sidebar from '../components/Sidebar'

const defaultWorkouts = [
  {
    category: 'Braços',
    name: 'Braço completo',
    desc: 'Treino focado em bíceps e tríceps',
    exercises: 4,
    iconClass: 'fa-solid fa-dumbbell',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
  },
  {
    category: 'Ombros',
    name: 'Ombros',
    desc: 'Foco em cada músculo do ombro',
    exercises: 4,
    iconClass: 'fa-solid fa-person-rays',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-500',
  },
  {
    category: 'Pernas',
    name: 'Pernas',
    desc: 'Ênfase nos músculos inferiores',
    exercises: 4,
    iconClass: 'fa-solid fa-shoe-prints',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-500',
  },
  {
    category: 'Peito',
    name: 'Peito',
    desc: 'Desenvolvimento completo dos peitorais',
    exercises: 4,
    iconClass: 'fa-solid fa-heart-pulse',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
  },
]

const myWorkouts = [
  { name: 'Meu treino ABC', desc: 'Treino personalizado', exercises: 4 },
]

function WorkoutCard({ workout, showActions = false }) {
  return (
    <div className="card bg-white border rounded-2xl p-5 relative">
      {showActions && (
        <div className="absolute top-3 right-3 flex gap-2">
          <button className="btn-action w-7 h-7 flex items-center justify-center border rounded-lg text-gray-400 hover:text-black hover:border-gray-400 text-xs">
            <i className="fa-solid fa-pen"></i>
          </button>
          <button className="btn-action w-7 h-7 flex items-center justify-center border rounded-lg text-gray-400 hover:text-red-500 hover:border-red-400 text-xs">
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      )}

      {!showActions && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400">{workout.category}</p>
          <div className={`w-8 h-8 ${workout.iconBg} rounded-lg flex items-center justify-center`}>
            <i className={`${workout.iconClass} ${workout.iconColor} text-sm`}></i>
          </div>
        </div>
      )}

      <h3 className={`font-semibold ${showActions ? 'mt-4' : ''}`}>{workout.name}</h3>
      <p className="text-sm text-gray-400 mb-4">{workout.desc}</p>
      <p className="text-xs text-gray-400 mb-4">{workout.exercises} exercícios</p>

      <div className="flex gap-2">
        <button className="btn-action flex-1 border rounded-lg py-1 text-sm hover:bg-gray-100">
          Visualizar
        </button>
        <button className="btn-action flex-1 bg-black text-white rounded-lg py-1 text-sm hover:bg-gray-800">
          Agendar
        </button>
      </div>
    </div>
  )
}

export default function Treinos() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Treinos fixos</h1>
          <p className="text-gray-400">
            Gerencie seus treinos personalizados e acesse templates prontos
          </p>
        </div>

        {/* Treinos padrão */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold">Treinos padrão</h2>
          <p className="text-gray-400 text-sm mb-6">
            Templates prontos criados pelo sistema
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {defaultWorkouts.map((w) => (
              <WorkoutCard key={w.name} workout={w} />
            ))}
          </div>
        </div>

        {/* Meus treinos */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold">Meus treinos</h2>
              <p className="text-gray-400 text-sm">
                Treinos personalizados criados por você
              </p>
            </div>
            <button className="btn-action bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800">
              + Criar Novo Treino
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {myWorkouts.map((w) => (
              <WorkoutCard key={w.name} workout={w} showActions />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
