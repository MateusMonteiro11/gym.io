export default function DescansoModal({

  aberto,

  restante,
  percentual,
  formatted,

  exercicio,
  serieAtual,
  totalSeries,

  ativo,

  onAdicionarTempo,
  onRemoverTempo,
  onPular,
  onContinuar,

}) {

  if (!aberto) return null

  const descansoFinalizado =
    restante <= 0 || !ativo

  return (

    <div className="
      fixed inset-0 z-50
      bg-black/50 backdrop-blur-sm
      flex items-center justify-center
      p-4
    ">

      <div className="
        w-full max-w-md
        bg-white rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-700/70
        shadow-2xl
        p-6
        animate-in fade-in zoom-in-95
      ">

        {/* HEADER */}
        <div className="text-center mb-6">

          <div className="
            w-20 h-20 mx-auto mb-4
            rounded-full
            bg-primary-muted
            flex items-center justify-center
          ">
            <i className="
              fa-solid fa-moon
              text-3xl text-primary dark:text-white
            " />
          </div>

          <h2 className="
            text-2xl font-bold text-slate-900 dark:text-slate-50
          ">
            Descanso
          </h2>

          <p className="
            text-sm text-slate-600 mt-1 dark:text-slate-300
          ">
            {descansoFinalizado
              ? 'Descanso concluído'
              : 'Recupere-se para a próxima série'}
          </p>

        </div>

        {/* TIMER */}
        <div className="mb-6">

          <div className="
            text-center text-6xl
            font-bold text-slate-900 dark:text-slate-50
            tracking-tight
          ">
            {formatted}
          </div>

          {/* BARRA */}
          <div className="
            w-full h-3 rounded-full
            bg-slate-50 mt-5 overflow-hidden dark:bg-slate-800
          ">

            <div
              className="
                h-full rounded-full
                bg-blue-500 transition-all duration-1000
              "
              style={{
                width: `${percentual}%`
              }}
            />

          </div>

        </div>

        {/* INFO */}
        <div className="
          bg-slate-50 rounded-2xl
          p-4 mb-6 border dark:border-slate-700/70 dark:bg-slate-800
        ">

          <p className="
            text-sm text-slate-600 mb-1 dark:text-slate-300
          ">
            Próxima série
          </p>

          <div className="
            flex items-center justify-between
          ">

            <div>

              <h3 className="
                font-semibold text-slate-700 dark:text-slate-100
              ">
                {exercicio?.nome}
              </h3>

              <p className="
                text-sm text-slate-600 dark:text-slate-300
              ">
                Série {serieAtual} de {totalSeries}
              </p>

            </div>

            <div className="
              w-12 h-12 rounded-xl
              bg-white border dark:border-slate-700/70 dark:bg-slate-900
              flex items-center justify-center
            ">
              <i className="
                fa-solid fa-dumbbell
                text-slate-600 dark:text-white
              " />
            </div>

          </div>

        </div>

        {/* CONTROLES */}
        {!descansoFinalizado ? (

          <>
            <div className="
              grid grid-cols-3 gap-3 mb-4
            ">

              <button
                onClick={() => onAdicionarTempo(15)}
                className="
                  py-3 rounded-xl
                  bg-slate-50 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700
                  font-medium transition-all
                "
              >
                +15s
              </button>

              <button
                onClick={() => onRemoverTempo(15)}
                className="
                  py-3 rounded-xl
                  bg-slate-50 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700
                  font-medium transition-all
                "
              >
                -15s
              </button>

              <button
                onClick={onPular}
                className="
                  py-3 rounded-xl
                  bg-red-100 text-red-600
                  hover:bg-red-200 dark:bg-red-950/60 dark:text-white dark:hover:bg-red-900/70
                  font-medium transition-all
                "
              >
                Pular
              </button>

            </div>

            <button
              onClick={onContinuar}
              className="
                w-full py-4 rounded-2xl
                bg-primary hover:bg-primary-hover
                text-white font-semibold
                transition-all
              "
            >
              Continuar treino
            </button>
          </>

        ) : (

          <button
            onClick={onContinuar}
            className="
              w-full py-4 rounded-2xl
              bg-emerald-500 hover:bg-emerald-600
              text-white font-semibold
              transition-all
            "
          >
            Continuar treino
          </button>

        )}

      </div>

    </div>
  )
}