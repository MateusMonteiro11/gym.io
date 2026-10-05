import { useState } from 'react'
import ActionLoading from './ui/ActionLoading'

const STATUS_LABEL = {
  idle        : { label: 'Pronto para iniciar', color: 'text-app-secondary' },
  ativo       : { label: 'Em andamento',         color: 'text-app-success' },
  descansando : { label: 'Descansando',           color: 'text-app-warning'  },
  finalizado  : { label: 'Concluído',             color: 'text-app-accent'   },
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
            className="text-xs px-3 py-1.5 bg-app-danger-action text-white rounded-lg font-medium hover:bg-app-danger-hover disabled:opacity-50 transition-colors"
          >
            {salvando ? <ActionLoading label="Salvando…" inverse /> : 'Cancelar'}
          </button>
          <button
            onClick={() => setConfirmando(false)}
            disabled={salvando}
            className="rounded-lg bg-app-muted px-3 py-1.5 text-xs font-medium text-app-ink transition-colors hover:bg-app-muted"
          >
            Voltar
          </button>
        </>
      ) : (
        <button
          onClick={handleSair}
          disabled={salvando}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold bg-app-muted text-app-ink shadow-sm ring-1 ring-app-line transition duration-200 hover:bg-app-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <i className="fa-solid fa-xmark" />
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-app-success-muted opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-app-success-muted" />
            </span>
          )}
          <span className={`text-xs font-medium uppercase tracking-widest ${statusInfo.color} `}>
            {statusInfo.label}
          </span>
        </div>

        <h1 className="text-2xl font-bold leading-tight text-app-ink">
          {nomeTreino || 'Treino'}
        </h1>

        <p className="mt-0.5 capitalize text-sm text-app-secondary">{dataHoje}</p>
      </div>

      <div className="hidden md:flex md:items-center">{actionButtons}</div>
    </div>
  )
}
