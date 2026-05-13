import { useEffect, useState } from 'react'

export default function AgendarTreinoModal({
  open,
  treino,
  onClose,
  onAgendar,
}) {
  const [dataAgendada, setDataAgendada] = useState('')
  const [agendando, setAgendando] = useState(false)

  useEffect(() => {
    if (!open) {
      setDataAgendada('')
      setAgendando(false)
    }
  }, [open])

  if (!open) return null

  const handleAgendar = async () => {
    if (!dataAgendada) {
      alert('Preencha a data do agendamento')
      return
    }

    try {
      setAgendando(true)
      await onAgendar({
        dataAgendada,
      })
      // Reset
      setDataAgendada('')
    } finally {
      setAgendando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Agendar Treino</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Escolha quando deseja realizar este treino
        </p>

        {/* Treino Selecionado */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">{treino?.nome}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {treino?.descricao || 'Sem descrição'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-dumbbell text-blue-600"></i>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            <i className="fa-solid fa-calendar mr-2"></i>Data agendada
          </label>
          <input
            type="date"
            value={dataAgendada}
            onChange={(e) => setDataAgendada(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={agendando}
            className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAgendar}
            disabled={agendando}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {agendando ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Agendando...
              </>
            ) : (
              <>
                <i className="fa-solid fa-calendar-check"></i>
                Agendar Treino
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
