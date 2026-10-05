import { useState } from 'react'
import ActionLoading from './ui/ActionLoading'

/**
 * @param {Object}   props
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 * @param {boolean}  props.finalizado
 * @param {boolean}  props.salvando
 * @param {Function} props.onIniciar
 * @param {Function} props.onAvancar
 * @param {Function} props.onFinalizar
 */

export default function WorkoutActions({
  status,
  finalizado,
  salvando,
  pausado = false,
  onIniciar,
  onAvancar,
  onFinalizar,
}) {
  const [confirmando, setConfirmando] = useState(false)

  const inativo      = status === 'idle' || status === 'finalizado'
  const podeAvancar  = status === 'ativo' && !finalizado && !salvando && !pausado

  // Tela de confirmação de finalização
  if (status === 'idle') {

  return (

      <button
        onClick={onIniciar}
        disabled={salvando}
        className="
          w-full py-4 rounded-2xl
          bg-app-action hover:bg-app-action-hover
          text-white font-semibold
          flex items-center justify-center gap-3
          transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60
        "
      >
        <i className="fa-solid fa-play text-white" />
        Iniciar treino
      </button>

    )
  }

  if (status === 'descansando') return null
  
  
  if (confirmando) {
    return (
      
      <div className="space-y-3 rounded-2xl border border-app-danger bg-app-surface p-4">
        <p className="text-center text-sm font-medium text-app-secondary">
          Finalizar o treino agora?
        </p>
        <p className="text-center text-xs text-app-secondary">
          O progresso até aqui será salvo.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmando(false)}
            disabled={salvando}
            className="flex-1 rounded-xl border border-app-line py-2.5 text-sm font-medium text-app-secondary transition-colors hover:bg-app-muted"
          >
            Cancelar
          </button>
          <button
            onClick={() => { setConfirmando(false); onFinalizar() }}
            disabled={salvando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-app-danger-action py-2.5 text-sm font-semibold text-white transition-colors hover:bg-app-danger-hover disabled:opacity-50"
          >
            {salvando ? (
              <ActionLoading label="Salvando…" inverse />
            ) : (
              <><i className="fa-solid fa-flag-checkered text-white" /> Finalizar</>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Avançar exercício */}
      <button
        onClick={onAvancar}
        disabled={!podeAvancar}
        className={`
          w-full py-3 rounded-xl text-sm font-semibold
          flex items-center justify-center gap-2
          transition-all duration-200
          ${podeAvancar
            ? 'bg-app-success-action text-white hover:bg-app-success-hover active:scale-[0.98]'
            : 'bg-app-muted text-app-secondary cursor-not-allowed'
          }
        `}
      >
        <i className="fa-solid fa-forward-step text-white" />
        Próximo exercício
      </button>

      {/* Linha: finalizar */}
      <div className="flex gap-2">
        <button
          onClick={() => setConfirmando(true)}
          disabled={(inativo && !finalizado) || salvando}
          className={`
            w-full py-3 rounded-xl text-sm font-semibold
            flex items-center justify-center gap-2
            transition-all duration-200
            ${!inativo || finalizado
              ? 'bg-app-danger-action text-white hover:bg-app-danger-hover active:scale-[0.98]'
              : 'bg-app-muted text-app-secondary cursor-not-allowed'
            }
          `}
        >
          <i className="fa-solid fa-flag-checkered text-white" />
          Finalizar treino
        </button>
      </div>
    </div>
  )
}
