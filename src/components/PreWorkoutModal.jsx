import { useState, useEffect } from 'react'

export default function PreWorkoutModal({
  open,
  treino,
  descansoPadrao = 60,
  onClose,
  onStart,
}) {

  const [descanso, setDescanso] = useState(descansoPadrao)

  useEffect(() => {
    if (open) {
      setDescanso(descansoPadrao)
    }
  }, [open, descansoPadrao])

  if (!open) return null

  return (
    <div className="
      fixed inset-0 z-50
      bg-black/50
      flex items-center justify-center
      p-4
    ">

      <div className="
        bg-white w-full max-w-md
        rounded-3xl p-6
        shadow-2xl
      ">

        <div className="mb-6">

          <h2 className="text-2xl font-bold text-gray-800">
            Iniciar treino
          </h2>

          <p className="text-gray-400 mt-1">
            Configure o descanso padrão do treino.
          </p>

        </div>

        {/* BOTÕES RÁPIDOS */}
        <div className="grid grid-cols-4 gap-2 mb-5">

          {[30, 45, 60, 90].map((tempo) => (

            <button
              key={tempo}
              onClick={() => setDescanso(tempo)}
              className={`
                py-3 rounded-xl font-semibold transition-all

                ${descanso === tempo
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {tempo}s
            </button>

          ))}

        </div>

        {/* INPUT CUSTOM */}
        <div className="mb-6">

          <label className="block text-sm font-medium text-gray-600 mb-2">
            Descanso personalizado
          </label>

          <input
            type="number"
            min="0"
            value={descanso}
            onChange={(e) =>
              setDescanso(Number(e.target.value))
            }
            className="
              w-full border border-gray-200
              rounded-xl px-4 py-3
              outline-none
              focus:ring-2 focus:ring-blue-500
            "
          />

        </div>

        {/* ACTIONS */}
        <div className="flex gap-3">

          <button
            onClick={onClose}
            className="
              flex-1 py-3 rounded-xl
              bg-gray-100 hover:bg-gray-200
              text-gray-600 font-semibold
            "
          >
            Cancelar
          </button>

          <button
            onClick={() => onStart(descanso)}
            className="
              flex-1 py-3 rounded-xl
              bg-blue-600 hover:bg-blue-700
              text-white font-semibold
            "
          >
            Começar treino
          </button>

        </div>

      </div>

    </div>
  )
}