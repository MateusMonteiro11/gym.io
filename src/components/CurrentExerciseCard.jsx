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
      <span className="ml-1 text-xs font-medium text-slate-600 dark:text-slate-300">
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
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, valorNumerico - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-sm font-bold text-slate-600 transition-colors hover:bg-gray-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          type="button"
        >−</button>
        <div className="relative w-20">
          <input
            type="number"
            min="0"
            value={valorNumerico}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-base font-bold text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-normal text-slate-600 dark:text-slate-300">
            {sufixo}
          </span>
        </div>
        <button
          onClick={() => onChange(valorNumerico + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-sm font-bold text-slate-600 transition-colors hover:bg-gray-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          type="button"
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
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">

      <div className="p-5 space-y-4">

        {/* Nome + série badges */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold leading-tight text-slate-900 dark:text-slate-50">
              {exercicio.nome}
            </h2>
            {exercicio.video && (
              <a
                href={exercicio.video}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-400 transition-colors hover:bg-red-100 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                title="Ver vídeo"
              >
                <i className="fa-brands fa-youtube text-sm dark:text-white" />
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
            <div key={label} className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800">
              <i className={`fa-solid ${icon} mb-1 block text-sm text-gray-300 dark:text-white`} />
              <p className="text-base font-bold text-slate-900 dark:text-slate-50">{valor}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</p>
            </div>
          ))}
        </div>

        {/* Descrição */}
        {exercicio.descricao && (
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{exercicio.descricao}</p>
        )}

        {/* Ajuste de carga/reps */}
        <div>
          <button
            onClick={() => setAjusteAberto((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-blue-500 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          >
            <i className={`fa-solid ${ajusteAberto ? 'fa-chevron-up' : 'fa-sliders'} text-[10px] dark:text-white`} />
            {ajusteAberto ? 'Fechar ajustes' : 'Ajustar carga / reps'}
          </button>

          {ajusteAberto && (
            <div className="mt-3 flex justify-around rounded-xl bg-slate-50 py-3 dark:bg-slate-800">
              <AjusteNumerico
                label="Carga"
                valor={carga}
                onChange={setCarga}
                sufixo="" /* Melhor vazio neste caso */
              />
              <div className="w-px bg-gray-200 dark:bg-slate-700" />
              <AjusteNumerico
                label="Reps"
                valor={repeticoes}
                onChange={setRepeticoes}
                sufixo="" /* Melhor vazio neste caso */
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
              ? 'bg-primary text-white hover:bg-primary-hover active:scale-[0.98] shadow-sm shadow-blue-200'
              : 'bg-slate-50 text-slate-600 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300'
            }
          `}
        >
          <i className="fa-solid fa-check dark:text-white" />
          {serieAtual < exercicio.series
            ? `Concluir série ${serieAtual}`
            : 'Concluir exercício'
          }
        </button>
      </div>
    </div>
  )
}