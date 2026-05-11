import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'

const nextExercises = [
  { num: 2, name: 'Rosca alternada',  sets: '3 séries • 12 reps' },
  { num: 3, name: 'Tríceps pulley',   sets: '3 séries • 15 reps' },
  { num: 4, name: 'Tríceps testa',    sets: '3 séries • 12 reps' },
]

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function Treinar() {
  const [elapsed, setElapsed]   = useState(0)
  const [running, setRunning]   = useState(false)
  const intervalRef             = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((t) => t + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Treinar</h1>
          <p className="text-gray-400">Sábado, 05 de março de 2026</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Esquerda */}
          <div className="lg:col-span-2 space-y-6">

            {/* Treino atual */}
            <div className="bg-white border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-lg">Treino atual</h2>
                  <p className="text-sm text-gray-400">Braço completo</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-dumbbell text-orange-500 text-xl"></i>
                </div>
              </div>

              {/* Progresso */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Progresso</span>
                  <span>1 de 4</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full w-1/4"></div>
                </div>
              </div>

              {/* Exercício atual */}
              <div className="exercise-card border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Rosca direta</h3>
                    <p className="text-sm text-gray-400">3 séries • 12 repetições</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-check text-blue-600"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Próximos exercícios */}
            <div className="bg-white border rounded-2xl p-6">
              <h2 className="font-semibold mb-4">Próximos exercícios</h2>
              <div className="space-y-3">
                {nextExercises.map((ex) => (
                  <div key={ex.num} className="exercise-card border rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                        {ex.num}
                      </div>
                      <div>
                        <h3 className="font-medium">{ex.name}</h3>
                        <p className="text-xs text-gray-400">{ex.sets}</p>
                      </div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-gray-300"></i>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Direita */}
          <div className="space-y-6">

            {/* Modo */}
            <div className="bg-white border rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <i className="fa-solid fa-gear text-gray-400"></i>
                <h3 className="font-semibold">Modo de treino</h3>
              </div>
              <p className="text-sm text-gray-400">Acompanhamento automático</p>
            </div>

            {/* Timer */}
            <div className="bg-blue-600 text-white rounded-2xl p-6 text-center">
              <p className="text-sm mb-2 opacity-80">Tempo de treino</p>
              <h2 className="text-4xl font-bold mb-4">{formatTime(elapsed)}</h2>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setRunning(true)}
                  className="btn-action bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  <i className="fa-solid fa-play mr-1"></i>
                  Iniciar
                </button>
                <button
                  onClick={() => setRunning(false)}
                  className="bg-blue-800 px-4 py-2 rounded-lg text-sm"
                >
                  <i className="fa-solid fa-pause"></i>
                </button>
              </div>
            </div>

            {/* Ações */}
            <div className="space-y-3">
              <button className="btn-action w-full bg-green-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-600">
                <i className="fa-solid fa-forward-step"></i>
                Próximo exercício
              </button>
              <button className="btn-action w-full bg-red-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-600">
                <i className="fa-solid fa-flag-checkered"></i>
                Finalizar treino
              </button>
            </div>

            {/* Informações */}
            <div className="bg-white border rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Informações</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Duração estimada</span>
                  <span>65 min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Exercícios restantes</span>
                  <span>3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Séries restantes</span>
                  <span>9</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
