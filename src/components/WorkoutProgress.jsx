/**
 * @param {Object}  props
 * @param {number}  props.percentual - 0–100
 * @param {number}  props.exerciciosFeitos
 * @param {number}  props.totalExercicios
 * @param {number}  props.serieAtual
 * @param {number}  props.totalSeries - Séries do exercício atual
 * @param {{ id_secao: number, nome: string, qtdExercicios: number }[]} props.secoes
 * @param {number}  props.idSecaoAtual
 */

export default function WorkoutProgress({
  percentual,
  exerciciosFeitos,
  totalExercicios,
  serieAtual,
  totalSeries,
  secoes = [],
  idSecaoAtual,
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">

      {/* Linha superior: label + contadores */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-300">
          Progresso
        </span>
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span>
            Exercício{' '}
            <strong className="text-slate-900 dark:text-slate-50">{Math.min(exerciciosFeitos + 1, totalExercicios)}</strong>
            {' '}de{' '}
            <strong className="text-slate-900 dark:text-slate-50">{totalExercicios}</strong>
          </span>
          <span className="text-gray-200 dark:text-slate-600">|</span>
          <span>
            Série{' '}
            <strong className="text-slate-900 dark:text-slate-50">{serieAtual}</strong>
            {' '}de{' '}
            <strong className="text-slate-900 dark:text-slate-50">{totalSeries}</strong>
          </span>
        </div>
      </div>

      {/* Barra principal */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-50 dark:bg-slate-800">
        <div
          className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentual}%` }}
        />
      </div>

      {/* Mapa de seções */}
      {secoes.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {secoes.map((secao) => {
            const ativa = secao.id_secao === idSecaoAtual
            return (
              <div
                key={secao.id_secao}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                  border transition-colors duration-200
                  ${ativa
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-[#0b0b0d] dark:border-white/[0.06] dark:text-blue-300'
                    : 'bg-slate-50 border-gray-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }
                `}
              >
                {/* Dot */}
                <span className={`h-1.5 w-1.5 rounded-full ${ativa ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-500'}`} />
                {secao.nome}
                <span className={ativa ? 'text-blue-400' : 'text-gray-300 dark:text-slate-500'}>
                  · {secao.qtdExercicios}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
