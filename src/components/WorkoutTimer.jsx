/**
 * @param {Object}   props
 * @param {string}   props.formatted - Tempo formatado "MM:SS"
 * @param {boolean}  props.isRunning
 * @param {Function} props.onToggle
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 */

export default function WorkoutTimer({ formatted, isRunning, onToggle, status }) {
  const finalizado = status === 'finalizado'
  const idle       = status === 'idle'

  return (
    <div className="rounded-2xl bg-primary p-6 text-center text-white dark:bg-slate-900 dark:border dark:border-slate-700/70">

      <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-70">
        Tempo de treino
      </p>

      <h2 className="text-5xl font-bold tabular-nums tracking-tight mb-1">
        {formatted}
      </h2>

      {/* Status textual */}
      <p className="mb-5 h-4 text-xs opacity-60">
        {finalizado ? 'Treino finalizado' : isRunning ? 'Cronômetro ativo' : 'Pausado'}
      </p>

      {/* Controles */}
      {!idle && !finalizado && (
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-primary transition-colors hover:bg-blue-50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
        >
          <i className={`fa-solid ${isRunning ? 'fa-pause' : 'fa-play'} dark:text-white`} />
          {isRunning ? 'Pausar' : 'Retomar'}
        </button>
      )}
    </div>
  )
}