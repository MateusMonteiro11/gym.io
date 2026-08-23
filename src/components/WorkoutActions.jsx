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
          bg-primary hover:bg-primary-hover
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
      
      <div className="space-y-3 rounded-2xl border border-red-100 bg-white p-4 dark:border-slate-700/70 dark:bg-slate-900/85">
        <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
          Finalizar o treino agora?
        </p>
        <p className="text-center text-xs text-slate-600 dark:text-slate-400">
          O progresso até aqui será salvo.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmando(false)}
            disabled={salvando}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={() => { setConfirmando(false); onFinalizar() }}
            disabled={salvando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
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
            ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98]'
            : 'bg-slate-50 text-slate-600 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300'
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
              ? 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]'
              : 'bg-slate-50 text-slate-600 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300'
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
