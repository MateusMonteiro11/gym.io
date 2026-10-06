import Card from '../../components/ui/Card.jsx'
import { ui } from '../../styles/theme.js'
import { numberLabel } from './historyModel.js'

function ExerciseList({ items, kind, partial }) {
  const isFrequency = kind === 'frequency'
  const title = isFrequency ? 'Mais realizados' : 'Maiores cargas registradas'
  const description = isFrequency
    ? 'Presença em treinos concluídos'
    : 'Maior registro por exercício'
  const emptyCopy = isFrequency
    ? 'Nenhum exercício concluído no período'
    : 'Nenhuma carga registrada no período'

  return (
    <Card as="article" hover={false} className="w-full min-w-0 p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-app-ink">{title}</h3>
        <p className="mt-1 text-sm text-app-secondary">{description}</p>
      </div>

      {items.length ? (
        <ol
          className="mt-5 space-y-1"
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex min-h-14 min-w-0 items-start gap-1.5 rounded-xl px-1.5 py-2 sm:gap-2 sm:px-2"
            >
              <span className="w-4 shrink-0 text-xs font-semibold leading-5 tabular-nums text-app-accent">
                {index + 1}
              </span>
              <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-1.5 gap-y-0.5 sm:gap-x-3">
                <strong className="col-start-1 row-start-1 line-clamp-2 min-w-0 break-words text-sm font-semibold leading-5 text-app-ink">
                  {item.name}
                </strong>
                {item.categoryName ? (
                  <small className="col-start-1 row-start-2 min-w-0 truncate text-xs text-app-secondary">
                    {item.categoryName}
                  </small>
                ) : null}
                <strong className="col-start-2 row-start-1 whitespace-nowrap text-right text-xs font-semibold leading-5 tabular-nums text-app-ink sm:text-sm">
                  {isFrequency
                    ? `${numberLabel(item.sessionCount)} ${item.sessionCount === 1 ? 'sessão' : 'sessões'}`
                    : `${numberLabel(item.weight, 2)} kg`}
                </strong>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex min-h-32 flex-col items-center justify-center px-4 py-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-app-secondary">{emptyCopy}</p>
        </div>
      )}

      {partial ? (
        <p className="mt-4 text-xs leading-relaxed text-app-secondary">
          Alguns registros incompletos podem não aparecer nesta lista.
        </p>
      ) : null}
    </Card>
  )
}

export default function FeaturedExercises({ data }) {
  return (
    <section aria-labelledby="history-featured-title">
      <div className="mb-6">
        <h2 id="history-featured-title" className={ui.sectionTitle}>Exercícios em destaque</h2>
        <p className={ui.sectionSubtitle}>Entenda quais exercícios mais aparecem nos seus treinos.</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ExerciseList items={data.mostPerformed} kind="frequency" partial={data.partial.occurrences} />
        <ExerciseList items={data.highestLoads} kind="load" partial={data.partial.loads} />
      </div>
    </section>
  )
}
