/**
 * @param {Object} props
 * @param {import('../utils/treinoUtils').ExercicioFlat[]} props.proximos
 * @param {number} props.idSecaoAtual   - Para detectar troca de seção
 */

export default function NextExercisesList({ proximos = [], idSecaoAtual }) {
  if (!proximos.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">
          Próximos exercícios
        </p>
        <p className="text-sm text-slate-600 text-center py-4">
          Este é o último exercício 🎉
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">
        Próximos exercícios
      </p>

      <div className="space-y-2">
        {proximos.map((ex, i) => {
          const trocaDeSecao = ex.id_secao !== idSecaoAtual

          return (
            <div key={ex.id_treino_exercicio}>
              {/* Divisor de seção */}
              {trocaDeSecao && (
                <div className="flex items-center gap-2 py-1.5">
                  <div className="flex-1 h-px bg-indigo-100" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 px-1">
                    {ex.secao}
                  </span>
                  <div className="flex-1 h-px bg-indigo-100" />
                </div>
              )}

              <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                {/* Número na fila */}
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center
                                text-xs font-semibold text-slate-600 flex-shrink-0">
                  {i + 2}
                </div>

                {/* Thumb */}
                {ex.imagem ? (
                  <img
                    src={ex.imagem}
                    alt={ex.nome}
                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center
                                  justify-center flex-shrink-0">
                    <i className="fa-solid fa-dumbbell text-blue-200 text-xs" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{ex.nome}</p>
                  <p className="text-xs text-slate-600">
                    {ex.series} séries · {ex.repeticoes} reps
                    {ex.carga > 0 && ` · ${ex.carga} kg`}
                  </p>
                </div>

                <i className="fa-solid fa-chevron-right text-gray-200 text-xs flex-shrink-0" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}