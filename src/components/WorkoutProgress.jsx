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
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">

      {/* Linha superior: label + contadores */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">
          Progresso
        </span>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span>
            Exercício{' '}
            <strong className="text-slate-900">{Math.min(exerciciosFeitos + 1, totalExercicios)}</strong>
            {' '}de{' '}
            <strong className="text-slate-900">{totalExercicios}</strong>
          </span>
          <span className="text-gray-200">|</span>
          <span>
            Série{' '}
            <strong className="text-slate-900">{serieAtual}</strong>
            {' '}de{' '}
            <strong className="text-slate-900">{totalSeries}</strong>
          </span>
        </div>
      </div>

      {/* Barra principal */}
      <div className="relative w-full h-2 bg-slate-50 rounded-full overflow-hidden">
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
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-slate-50 border-gray-100 text-slate-600'
                  }
                `}
              >
                {/* Dot */}
                <span className={`w-1.5 h-1.5 rounded-full ${ativa ? 'bg-blue-500' : 'bg-gray-300'}`} />
                {secao.nome}
                <span className={ativa ? 'text-blue-400' : 'text-gray-300'}>
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