import { useState } from 'react'

const STATUS_LABEL = {
  idle        : { label: 'Pronto para iniciar', color: 'text-gray-400' },
  ativo       : { label: 'Em andamento',         color: 'text-emerald-400' },
  descansando : { label: 'Descansando',           color: 'text-amber-400'  },
  finalizado  : { label: 'Concluído',             color: 'text-blue-400'   },
}

/**
 * @param {Object}   props
 * @param {string}   props.nomeTreino
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 * @param {Function} props.onSair - Abre confirmação e chama finalizarTreino
 * @param {boolean}  [props.salvando]
 */
export default function WorkoutHeader({ nomeTreino, status, onSair, salvando = false }) {
  const [confirmando, setConfirmando] = useState(false)

  const statusInfo = STATUS_LABEL[status] ?? STATUS_LABEL.idle

  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    weekday : 'long',
    day     : 'numeric',
    month   : 'long',
    year    : 'numeric',
  })

  function handleSair() {
    if (status === 'finalizado') { onSair(); return }
    setConfirmando(true)
  }

  return (
    <div className="flex items-start justify-between mb-8">

      {/* Identidade */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          {/* Pulse indicator */}
          {status === 'ativo' && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          <span className={`text-xs font-medium uppercase tracking-widest ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          {nomeTreino || 'Treino'}
        </h1>

        <p className="text-sm text-gray-400 mt-0.5 capitalize">{dataHoje}</p>
      </div>

      {/* Botão sair / confirmar */}
      <div className="flex items-center gap-2">
        {confirmando ? (
          <>
            <span className="text-xs text-gray-500 mr-1">Finalizar treino?</span>
            <button
              onClick={() => { setConfirmando(false); onSair() }}
              disabled={salvando}
              className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg font-medium
                         hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {salvando ? 'Salvando…' : 'Confirmar'}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-medium
                         hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            onClick={handleSair}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700
                       px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="fa-solid fa-xmark" />
            <span>Sair</span>
          </button>
        )}
      </div>
    </div>
  )
}