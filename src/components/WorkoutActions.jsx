import { useState } from 'react'

/**
 * @param {Object}   props
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 * @param {number}   props.indexAtual
 * @param {boolean}  props.finalizado
 * @param {boolean}  props.salvando
 * @param {Function} props.onIniciar
 * @param {Function} props.onAvancar
 * @param {Function} props.onFinalizar
 */

export default function WorkoutActions({
  status,
  indexAtual,
  finalizado,
  salvando,
  onIniciar,
  onAvancar,
  onFinalizar,
}) {
  const [confirmando, setConfirmando] = useState(false)

  const inativo      = status === 'idle' || status === 'finalizado'
  const podeAvancar  = !inativo && !finalizado

  // Tela de confirmação de finalização
  if (status === 'idle') {

  return (

      <button
        onClick={onIniciar}
        className="
          w-full py-4 rounded-2xl
          bg-primary hover:bg-primary-hover
          text-white font-semibold
          flex items-center justify-center gap-3
          transition-all duration-200
        "
      >
        <i className="fa-solid fa-play" />
        Iniciar treino
      </button>

    )
  }
  
  
  if (confirmando) {
    return (
      
      <div className="bg-white border border-red-100 rounded-2xl p-4 space-y-3">
        <p className="text-sm text-slate-600 text-center font-medium">
          Finalizar o treino agora?
        </p>
        <p className="text-xs text-slate-600 text-center">
          O progresso até aqui será salvo.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmando(false)}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm
                       font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => { setConfirmando(false); onFinalizar() }}
            disabled={salvando}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm
                       font-semibold hover:bg-red-600 disabled:opacity-50
                       transition-colors flex items-center justify-center gap-2"
          >
            {salvando ? (
              <><i className="fa-solid fa-spinner animate-spin" /> Salvando…</>
            ) : (
              <><i className="fa-solid fa-flag-checkered" /> Finalizar</>
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
            : 'bg-slate-50 text-slate-600 cursor-not-allowed'
          }
        `}
      >
        <i className="fa-solid fa-forward-step" />
        Próximo exercício
      </button>

      {/* Linha: finalizar */}
      <div className="flex gap-2">
        <button
          onClick={() => setConfirmando(true)}
          disabled={inativo && !finalizado}
          className={`
            w-full py-3 rounded-xl text-sm font-semibold
            flex items-center justify-center gap-2
            transition-all duration-200
            ${!inativo || finalizado
              ? 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]'
              : 'bg-slate-50 text-slate-600 cursor-not-allowed'
            }
          `}
        >
          <i className="fa-solid fa-flag-checkered" />
          Finalizar treino
        </button>
      </div>
    </div>
  )
}