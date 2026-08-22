/**
 * @param {Object}   props
 * @param {string}   props.formatted - Tempo formatado "MM:SS"
 * @param {boolean}  props.isRunning
 * @param {Function} props.onToggle
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 */

export default function WorkoutTimer({
  formatted,
  isRunning,
  onToggle,
  status,
  disabled = false,
  pausado = false,
  percentualDescanso = 0,
  proximaSerie,
  onAdicionarTempo,
  onPularDescanso,
}) {
  const finalizado = status === 'finalizado'
  const idle       = status === 'idle'
  const descansando = status === 'descansando'
  const timerAtivo = descansando ? !pausado : isRunning

  const statusTexto = finalizado
    ? 'Treino finalizado'
    : descansando && pausado
      ? 'Descanso pausado'
      : descansando
        ? 'Recupere-se para a próxima série'
        : isRunning
          ? 'Cronômetro ativo'
          : 'Treino pausado'

  return (
    <section
      className={`overflow-hidden rounded-2xl p-5 text-center text-white shadow-lg sm:p-6 ${
        descansando
          ? 'bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 shadow-blue-300/30 dark:from-indigo-600 dark:via-blue-600 dark:to-cyan-600 dark:shadow-black/70'
          : 'bg-primary shadow-blue-300/30 dark:border dark:border-slate-700/70 dark:bg-slate-900 dark:shadow-none'
      }`}
      aria-live="polite"
    >

      <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-70">
        {descansando ? 'Descanso' : 'Tempo de treino'}
      </p>

      <h2 className="mb-1 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
        {formatted}
      </h2>

      {/* Status textual */}
      <p className="text-xs font-medium text-white/75">
        {statusTexto}
      </p>

      {descansando && (
        <>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20 dark:bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-700 dark:bg-white"
              style={{ width: `${Math.max(0, Math.min(100, percentualDescanso))}%` }}
            />
          </div>

          {proximaSerie && (
            <p className="mt-3 truncate text-xs text-white/75">
              Próxima: <span className="font-semibold text-white">{proximaSerie}</span>
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onAdicionarTempo}
              disabled={disabled || pausado}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-blue-700 dark:hover:bg-blue-50"
            >
              <i className="fa-solid fa-plus" />
              +15s
            </button>
            <button
              type="button"
              onClick={onToggle}
              disabled={disabled}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            >
              <i className={`fa-solid ${pausado ? 'fa-play' : 'fa-pause'}`} />
              {pausado ? 'Retomar' : 'Pausar treino'}
            </button>
          </div>

          <button
            type="button"
            onClick={onPularDescanso}
            disabled={disabled || pausado}
            className="mx-auto mt-3 flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <i className="fa-solid fa-forward" />
            Pular descanso
          </button>
        </>
      )}

      {/* Controle do cronômetro de treino */}
      {!descansando && !idle && !finalizado && (
        <button
          onClick={onToggle}
          disabled={disabled}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-primary transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
        >
          <i className={`fa-solid ${timerAtivo ? 'fa-pause' : 'fa-play'} dark:text-white`} />
          {timerAtivo ? 'Pausar' : 'Retomar'}
        </button>
      )}
    </section>
  )
}
