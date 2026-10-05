import { useEffect, useReducer, useState } from 'react'
import ContentEntrance from './ui/ContentEntrance'
import {
  criarChaveFormularioSerie,
  criarEstadoFormularioSerie,
  reduzirEstadoFormularioSerie,
} from '../utils/currentExerciseFormState'
import ActionLoading from './ui/ActionLoading'


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
              ? 'w-5 bg-app-action'
              : i === serieAtual - 1
                ? 'w-5 bg-app-action ring-2 ring-app-accent'
                : 'w-3 bg-app-muted'
            }
          `}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-app-secondary">
        {serieAtual} / {totalSeries}
      </span>
    </div>
  )
}

 /* Campo de ajuste numérico (carga ou reps) */
function AjusteNumerico({ label, valor, valorNumerico, onChange, onBlur, sufixo, disabled = false }) {
  return (
    <div className="flex flex-col items-center gap-2 sm:max-w-[11rem]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-app-secondary">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, valorNumerico - 1))}
          disabled={disabled}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-muted text-sm font-bold text-app-secondary transition-colors hover:bg-app-muted"
          type="button"
        >−</button>
        <div className="relative w-20">
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            aria-label={label}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            className="w-full rounded-lg border border-app-line bg-app-surface px-2 py-2 text-center text-base font-bold text-app-ink focus:border-app-accent focus:ring-1 focus:ring-app-accent"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-normal text-app-secondary">
            {sufixo}
          </span>
        </div>
        <button
          onClick={() => onChange(valorNumerico + 1)}
          disabled={disabled}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-muted text-sm font-bold text-app-secondary transition-colors hover:bg-app-muted"
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
 * @param {{carga: number, repeticoes: number}} props.valoresIniciais
 * @param {'idle'|'ativo'|'descansando'|'finalizado'} props.status
 * @param {number}   props.tempoDescanso
 * @param {Function} props.onConcluirSerie   - (ajustes: { carga, repeticoes }) => void
 */

export default function CurrentExerciseCard({
  exercicio,
  serieAtual,
  valoresIniciais,
  status,
  tempoDescanso,
  onConcluirSerie,
  processando = false,
  pausado = false,
}) {
  const chaveSerie = criarChaveFormularioSerie(
    exercicio?.id_treino_exercicio,
    serieAtual
  )
  const cargaInicial = valoresIniciais?.carga ?? exercicio?.carga ?? 0
  const repeticoesIniciais = valoresIniciais?.repeticoes ?? exercicio?.repeticoes ?? 0
  const [formulario, dispatchFormulario] = useReducer(
    reduzirEstadoFormularioSerie,
    null,
    () => criarEstadoFormularioSerie(chaveSerie, {
      carga: cargaInicial,
      repeticoes: repeticoesIniciais,
    })
  )
  const [ajusteAberto, setAjusteAberto] = useState(false)

  // Inicializa uma vez por série e aceita defaults assíncronos apenas enquanto
  // o usuário ainda não editou o formulário atual.
  useEffect(() => {
    dispatchFormulario({
      type: 'sincronizar',
      chaveSerie,
      valoresIniciais: {
        carga: cargaInicial,
        repeticoes: repeticoesIniciais,
      },
    })
  }, [cargaInicial, chaveSerie, repeticoesIniciais])

  useEffect(() => {
    setAjusteAberto(false)
  }, [chaveSerie])

  if (!exercicio) return null

  const { carga, repeticoes } = formulario
  const podeInteragir = status === 'ativo' && !processando && !pausado

  function handleConcluir() {
    dispatchFormulario({ type: 'confirmar' })
    onConcluirSerie({ carga, repeticoes })
  }

  function alternarAjustes() {
    if (ajusteAberto) dispatchFormulario({ type: 'confirmar' })
    setAjusteAberto((aberto) => !aberto)
  }

  return (
    <ContentEntrance replay className="overflow-hidden rounded-2xl border border-app-line bg-app-surface dark:shadow-black/20">

      <div className="p-5 space-y-4">

        {/* Nome + série badges */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-app-secondary">
            {status === 'descansando' ? 'Próxima série' : 'Exercício atual'}
          </p>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold leading-tight text-app-ink">
              {exercicio.nome}
            </h2>
            {exercicio.video && (
              <a
                href={exercicio.video}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-app-danger-muted text-app-danger transition-colors hover:bg-app-danger-muted"
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
            <div key={label} className="rounded-xl bg-app-muted p-3 text-center">
              <i className={`fa-solid ${icon} mb-1 block text-sm text-app-secondary `} />
              <p className="text-base font-bold text-app-ink">{valor}</p>
              <p className="text-[10px] uppercase tracking-wide text-app-secondary">{label}</p>
            </div>
          ))}
        </div>

        {/* Descrição */}
        {exercicio.descricao && (
          <p className="text-sm leading-relaxed text-app-secondary">{exercicio.descricao}</p>
        )}

        {/* Ajuste de carga/reps */}
        {status !== 'descansando' && <div>
          <button
            onClick={alternarAjustes}
            disabled={processando || pausado}
            className="flex items-center gap-1 text-xs font-medium text-app-accent transition-colors hover:text-app-accent"
          >
            <i className={`fa-solid ${ajusteAberto ? 'fa-chevron-up' : 'fa-sliders'} text-[10px] `} />
            {ajusteAberto ? 'Fechar ajustes' : 'Ajustar carga / reps'}
          </button>

          {ajusteAberto && (
            <div className="mt-3 rounded-xl bg-app-muted p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
                <AjusteNumerico
                  label="Carga"
                  valor={formulario.cargaTexto}
                  valorNumerico={carga}
                  onBlur={() => dispatchFormulario({ type: 'confirmar_carga' })}
                  onChange={(valor) => dispatchFormulario({
                    type: 'editar_carga',
                    valor,
                  })}
                  disabled={processando || pausado}
                  sufixo="" /* Melhor vazio neste caso */
                />
                <div className="hidden sm:block h-12 w-px bg-app-muted" />
                <AjusteNumerico
                  label="Reps"
                  valor={formulario.repeticoesTexto}
                  valorNumerico={repeticoes}
                  onBlur={() => dispatchFormulario({ type: 'confirmar_repeticoes' })}
                  onChange={(valor) => dispatchFormulario({
                    type: 'editar_repeticoes',
                    valor,
                  })}
                  disabled={processando || pausado}
                  sufixo="" /* Melhor vazio neste caso */
                />
              </div>
            </div>
          )}
        </div>}

        {/* Botão concluir série */}
        {status !== 'descansando' && <button
          onClick={handleConcluir}
          disabled={!podeInteragir}
          className={`
            w-full py-3.5 rounded-xl font-semibold text-sm
            flex items-center justify-center gap-2
            transition-all duration-200
            ${podeInteragir
              ? 'bg-app-action text-white hover:bg-app-action-hover active:scale-[0.98] shadow-sm shadow-blue-200 dark:shadow-none'
              : 'bg-app-muted text-app-secondary cursor-not-allowed'
            }
          `}
        >
          {!processando && <i className="fa-solid fa-check" />}
          {processando
            ? <ActionLoading label="Salvando série…" inverse />
            : pausado
              ? 'Retome o cronômetro para continuar'
              : serieAtual < exercicio.series
            ? `Concluir série ${serieAtual}`
            : 'Concluir exercício'
          }
        </button>}
      </div>
    </ContentEntrance>
  )
}
