/**
 * @param {Object}   props
 * @param {string}   props.formatted - Tempo formatado "MM:SS"
 * @param {boolean}  props.isRunning
 * @param {Function} props.onToggle 
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 * @param {Function} props.onIniciar - Só será usado no estado idle
 */

export default function WorkoutTimer({ formatted, isRunning, onToggle, status, onIniciar }) {
  const finalizado = status === 'finalizado'
  const idle       = status === 'idle'

  return (
    <div className="bg-primary text-white rounded-2xl p-6 text-center">

      <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-2">
        Tempo de treino
      </p>

      <h2 className="text-5xl font-bold tabular-nums tracking-tight mb-1">
        {formatted}
      </h2>

      {/* Status textual */}
      <p className="text-xs opacity-60 mb-5 h-4">
        {finalizado ? 'Treino finalizado' : isRunning ? 'Cronômetro ativo' : 'Pausado'}
      </p>

      {/* Controles */}
      {idle ? (
        <button
          onClick={onIniciar}
          className="w-full bg-white text-primary py-2.5 rounded-xl text-sm font-bold
                     hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-play" />
          Iniciar treino
        </button>
      ) : finalizado ? (
        <div className="w-full bg-blue-500 py-2.5 rounded-xl text-sm font-bold
                        flex items-center justify-center gap-2 opacity-60 cursor-default">
          <i className="fa-solid fa-flag-checkered" />
          Concluído
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onToggle}
            className="flex-1 bg-white text-primary py-2.5 rounded-xl text-sm font-bold
                       hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            <i className={`fa-solid ${isRunning ? 'fa-pause' : 'fa-play'}`} />
            {isRunning ? 'Pausar' : 'Retomar'}
          </button>
        </div>
      )}
    </div>
  )
}