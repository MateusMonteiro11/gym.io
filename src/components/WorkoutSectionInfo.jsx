/**
 * @param {Object}  props
 * @param {string}  props.nomeSecao
 * @param {string}  [props.descricaoSecao]
 * @param {number}  props.ordemSecao
 * @param {boolean} props.visivel
 */
export default function WorkoutSectionInfo({ nomeSecao, descricaoSecao, ordemSecao, visivel }) {
  if (!visivel) return null

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl px-5 py-4
        bg-gradient-to-r from-brand/5 to-emerald-500/5
        border border-brand/15
        animate-fade-in
      `}
    >
      {/* Linha colorida lateral */}
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-emerald-400 rounded-l-2xl" />

      <div className="pl-3">
        <p className="section-label text-brand mb-0.5">
          Iniciando bloco {ordemSecao}
        </p>
        <h3 className="font-display text-base font-bold text-ink">{nomeSecao}</h3>
        {descricaoSecao && (
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{descricaoSecao}</p>
        )}
      </div>
    </div>
  )
}