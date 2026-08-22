import { useState } from 'react'

const STATUS_LABEL = {
  idle        : { label: 'Pronto para iniciar', color: 'text-slate-600' },
  ativo       : { label: 'Em andamento',         color: 'text-emerald-400' },
  descansando : { label: 'Descansando',           color: 'text-amber-400'  },
  finalizado  : { label: 'Concluído',             color: 'text-blue-400'   },
}

/**
 * @param {Object}   props
 * @param {string}   props.nomeTreino
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 * @param {Function} props.onSair - Cancela o treino, descarta histórico e volta para a tela de treinos
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
    if (status === 'finalizado' || status === 'idle') {
      onSair()
      return
    }
    setConfirmando(true)
  }

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {confirmando ? (
        <>
          <button
            onClick={() => { setConfirmando(false); onSair() }}
            disabled={salvando}
            className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {salvando ? 'Salvando…' : 'Cancelar'}
          </button>
          <button
            onClick={() => setConfirmando(false)}
            disabled={salvando}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Voltar
          </button>
        </>
      ) : (
        <button
          onClick={handleSair}
          disabled={salvando}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold bg-slate-100 text-slate-900 shadow-sm ring-1 ring-slate-200 transition duration-200 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700"
        >
          <i className="fa-solid fa-xmark dark:text-white" />
          <span>Cancelar</span>
        </button>
      )}
    </div>
  )

  return (
    <div className="grid gap-3 mb-8 md:flex md:items-start md:justify-between">

      {/* Identidade */}
      <div className="grid gap-3">
        <div className="md:hidden">{actionButtons}</div>

        <div className="flex items-center gap-2">
          {/* Pulse indicator */}
          {status === 'ativo' && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          <span className={`text-xs font-medium uppercase tracking-widest ${statusInfo.color} dark:text-slate-300`}>
            {statusInfo.label}
          </span>
        </div>

        <h1 className="text-2xl font-bold leading-tight text-slate-900 dark:text-slate-50">
          {nomeTreino || 'Treino'}
        </h1>

        <p className="mt-0.5 capitalize text-sm text-slate-600 dark:text-slate-300">{dataHoje}</p>
      </div>

      <div className="hidden md:flex md:items-center">{actionButtons}</div>
    </div>
  )
}
