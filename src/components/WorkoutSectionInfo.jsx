// ─────────────────────────────────────────────
// WorkoutSectionInfo.jsx
// Banner de transição de seção
// ─────────────────────────────────────────────
//
// Responsabilidade: aparecer SOMENTE quando o
// usuário avança para um exercício que pertence
// a uma seção diferente da anterior. Informativo,
// não interativo.
//
// Controle de visibilidade: o pai (Treinar.jsx)
// passa `visivel`, que é true quando
// exercicioAtual.id_secao !== secaoAnterior.id_secao
// por um breve período (ex.: 4 segundos).
//
// Props vindas de useTreinoAtivo:
//   exercicioAtual.secao, exercicioAtual.descricaoSecao

/**
 * @param {Object}  props
 * @param {string}  props.nomeSecao
 * @param {string}  [props.descricaoSecao]
 * @param {number}  props.ordemSecao       - ex.: 2 → "Bloco 2"
 * @param {boolean} props.visivel
 */
export default function WorkoutSectionInfo({ nomeSecao, descricaoSecao, ordemSecao, visivel }) {
  if (!visivel) return null

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl px-5 py-4
        bg-gradient-to-r from-indigo-50 to-blue-50
        border border-indigo-100
        animate-fade-in
      `}
    >
      {/* Linha colorida lateral */}
      <div className="absolute inset-y-0 left-0 w-1 bg-indigo-400 rounded-l-2xl" />

      <div className="pl-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">
          Iniciando bloco {ordemSecao}
        </p>
        <h3 className="text-base font-bold text-indigo-900">{nomeSecao}</h3>
        {descricaoSecao && (
          <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">{descricaoSecao}</p>
        )}
      </div>
    </div>
  )
}