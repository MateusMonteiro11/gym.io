import { useMemo } from 'react'

export default function DescansoModal({

  aberto,

  restante,
  total,
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
        bg-white rounded-3xl
        shadow-2xl
        p-6
        animate-in fade-in zoom-in-95
      ">

        {/* HEADER */}
        <div className="text-center mb-6">

          <div className="
            w-20 h-20 mx-auto mb-4
            rounded-full
            bg-blue-100
            flex items-center justify-center
          ">
            <i className="
              fa-solid fa-moon
              text-3xl text-blue-600
            " />
          </div>

          <h2 className="
            text-2xl font-bold text-gray-800
          ">
            Descanso
          </h2>

          <p className="
            text-sm text-gray-400 mt-1
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
            font-bold text-gray-800
            tracking-tight
          ">
            {formatted}
          </div>

          {/* BARRA */}
          <div className="
            w-full h-3 rounded-full
            bg-gray-100 mt-5 overflow-hidden
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
          bg-gray-50 rounded-2xl
          p-4 mb-6 border
        ">

          <p className="
            text-sm text-gray-400 mb-1
          ">
            Próxima série
          </p>

          <div className="
            flex items-center justify-between
          ">

            <div>

              <h3 className="
                font-semibold text-gray-700
              ">
                {exercicio?.nome}
              </h3>

              <p className="
                text-sm text-gray-500
              ">
                Série {serieAtual} de {totalSeries}
              </p>

            </div>

            <div className="
              w-12 h-12 rounded-xl
              bg-white border
              flex items-center justify-center
            ">
              <i className="
                fa-solid fa-dumbbell
                text-gray-600
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
                  bg-gray-100 hover:bg-gray-200
                  font-medium transition-all
                "
              >
                +15s
              </button>

              <button
                onClick={() => onRemoverTempo(15)}
                className="
                  py-3 rounded-xl
                  bg-gray-100 hover:bg-gray-200
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
                  hover:bg-red-200
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
                bg-blue-600 hover:bg-blue-700
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