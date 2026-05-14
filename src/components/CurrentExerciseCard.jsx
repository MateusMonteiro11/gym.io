import { useState, useEffect } from 'react'


 /* Badge de série (ex.: "Série 2 / 3") */
function SerieBadge({ serieAtual, totalSeries }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: totalSeries }, (_, i) => (
        <span
          key={i}
          className={`
            h-1.5 rounded-full transition-all duration-300
            ${i < serieAtual
              ? 'w-5 bg-blue-500'
              : i === serieAtual - 1
                ? 'w-5 bg-blue-500 ring-2 ring-blue-200'
                : 'w-3 bg-gray-200'
            }
          `}
        />
      ))}
      <span className="ml-1 text-xs text-gray-400 font-medium">
        {serieAtual} / {totalSeries}
      </span>
    </div>
  )
}

 /* Campo de ajuste numérico (carga ou reps) */
function AjusteNumerico({ label, valor, onChange, sufixo }) {
  const valorNumerico = Number(valor) || 0

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(0, valorNumerico - 1))}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600
                     flex items-center justify-center text-sm font-bold transition-colors"
        >−</button>
        <span className="w-12 text-center font-bold text-gray-900 text-base tabular-nums">
          {valorNumerico}
          <span className="text-xs font-normal text-gray-400 ml-0.5">{sufixo}</span>
        </span>
        <button
          onClick={() => onChange(valorNumerico + 1)}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600
                     flex items-center justify-center text-sm font-bold transition-colors"
        >+</button>
      </div>
    </div>
  )
}

/**
 * @param {Object}   props
 * @param {import('../utils/treinoUtils').ExercicioFlat | null} props.exercicio
 * @param {number}   props.serieAtual
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 * @param {number}   props.tempoDescanso
 * @param {Function} props.onConcluirSerie   - (ajustes: { carga, repeticoes }) => void
 */

export default function CurrentExerciseCard({ exercicio, serieAtual, status, tempoDescanso, onConcluirSerie }) {
  const [carga,      setCarga]      = useState(0)
  const [repeticoes, setRepeticoes] = useState(0)
  const [ajusteAberto, setAjusteAberto] = useState(false)

  // Sincroniza com os valores do exercício ao mudar de exercício ou série
  useEffect(() => {
    setCarga(Number(exercicio?.carga ?? 0))
    setRepeticoes(Number(exercicio?.repeticoes ?? 0))
    setAjusteAberto(false)
  }, [exercicio, serieAtual])

  if (!exercicio) return null

  const podeInteragir = status === 'ativo'

  function handleConcluir() {
    onConcluirSerie({ carga: Number(carga), repeticoes: Number(repeticoes) })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

      <div className="p-5 space-y-4">

        {/* Nome + série badges */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              {exercicio.nome}
            </h2>
            {exercicio.video && (
              <a
                href={exercicio.video}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 flex items-center
                           justify-center text-red-400 hover:bg-red-100 transition-colors"
                title="Ver vídeo"
              >
                <i className="fa-brands fa-youtube text-sm" />
              </a>
            )}
          </div>

          <SerieBadge serieAtual={serieAtual} totalSeries={exercicio.series} />
        </div>

        {/* Métricas principais (carga / reps / descanso) */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Carga',    valor: `${carga} kg`,              icon: 'fa-weight-hanging' },
            { label: 'Reps',     valor: repeticoes,                 icon: 'fa-rotate-right'   },
            { label: 'Descanso', valor: `${tempoDescanso}s`,        icon: 'fa-clock'          },
          ].map(({ label, valor, icon }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <i className={`fa-solid ${icon} text-gray-300 text-sm mb-1 block`} />
              <p className="text-base font-bold text-gray-900">{valor}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Descrição */}
        {exercicio.descricao && (
          <p className="text-sm text-gray-500 leading-relaxed">{exercicio.descricao}</p>
        )}

        {/* Ajuste inline de carga/reps */}
        <div>
          <button
            onClick={() => setAjusteAberto((v) => !v)}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium
                       flex items-center gap-1 transition-colors"
          >
            <i className={`fa-solid ${ajusteAberto ? 'fa-chevron-up' : 'fa-sliders'} text-[10px]`} />
            {ajusteAberto ? 'Fechar ajustes' : 'Ajustar carga / reps'}
          </button>

          {ajusteAberto && (
            <div className="mt-3 flex justify-around py-3 bg-gray-50 rounded-xl">
              <AjusteNumerico
                label="Carga"
                valor={carga}
                onChange={setCarga}
                sufixo="kg"
              />
              <div className="w-px bg-gray-200" />
              <AjusteNumerico
                label="Reps"
                valor={repeticoes}
                onChange={setRepeticoes}
                sufixo="×"
              />
            </div>
          )}
        </div>

        {/* Botão concluir série */}
        <button
          onClick={handleConcluir}
          disabled={!podeInteragir}
          className={`
            w-full py-3.5 rounded-xl font-semibold text-sm
            flex items-center justify-center gap-2
            transition-all duration-200
            ${podeInteragir
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-sm shadow-blue-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <i className="fa-solid fa-check" />
          {serieAtual < exercicio.series
            ? `Concluir série ${serieAtual}`
            : 'Concluir exercício'
          }
        </button>
      </div>
    </div>
  )
}