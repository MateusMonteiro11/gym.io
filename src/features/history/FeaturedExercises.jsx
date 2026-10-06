import HistoryCard from './HistoryCard.jsx'
import { ui } from '../../styles/theme.js'
import { numberLabel } from './historyModel.js'

function ExerciseList({ items, kind, partial }) {
  const isFrequency = kind === 'frequency'
  return <div className="history-ranking">
    <div className="history-card-heading">
      <h3>{isFrequency ? 'Mais realizados' : 'Maiores cargas registradas'}</h3>
      <p>{isFrequency ? 'Presença em treinos concluídos' : 'Maior registro por exercício'}</p>
    </div>
    {items.length ? <ol className="history-ranking-list" role="list">
      {items.map((item) => <li key={item.id}>
        <div className="history-ranking-body">
          <strong className="history-ranking-name">{item.name}</strong>
          {item.categoryName && <small>{item.categoryName}</small>}
          <span className="history-ranking-value">{isFrequency
            ? `${numberLabel(item.sessionCount)} ${item.sessionCount === 1 ? 'sessão' : 'sessões'}`
            : `${numberLabel(item.weight, 2)} kg`}</span>
        </div>
      </li>)}
    </ol> : <div className="history-ranking-empty"><p>{isFrequency ? 'Nenhum exercício concluído no período' : 'Nenhuma carga registrada no período'}</p></div>}
    {partial && <p className="history-partial-note">Alguns registros incompletos podem não aparecer nesta lista.</p>}
  </div>
}

export default function FeaturedExercises({ data }) {
  return <HistoryCard as="section" className="history-featured" aria-labelledby="history-featured-title">
    <div className="history-section-heading">
      <h2 id="history-featured-title" className={ui.sectionTitle}>Exercícios em destaque</h2>
      <p className={ui.sectionSubtitle}>Os Top 3 do período, por presença e carga registrada.</p>
    </div>
    <div className="history-ranking-grid">
      <ExerciseList items={data.mostPerformed} kind="frequency" partial={data.partial.occurrences} />
      <ExerciseList items={data.highestLoads} kind="load" partial={data.partial.loads} />
    </div>
  </HistoryCard>
}
