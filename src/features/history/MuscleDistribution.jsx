import { motion, useReducedMotion } from 'framer-motion'
import { Layers3 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import Card from '../../components/ui/Card.jsx'
import Disclosure from '../../components/ui/Disclosure.jsx'
import { ui } from '../../styles/theme.js'
import { numberLabel } from './historyModel.js'
import ChartDataTable from './ChartDataTable.jsx'

function percentageLabel(value) {
  return `${numberLabel(value, value < 10 ? 1 : 0)}%`
}

function occurrenceLabel(count) {
  return `${numberLabel(count)} ${count === 1 ? 'aparição' : 'aparições'}`
}

export function CategoryBreakdown({ items, selectedId, onSelect }) {
  const reduceMotion = useReducedMotion()
  const visible = items.slice(0, 5)
  const additional = items.slice(5)
  return <>
    <ol className="space-y-1" aria-label="Categorias musculares mais presentes">
      {visible.map((item, index) => <li key={item.id}>
        <button
          type="button"
          aria-pressed={selectedId === item.id}
          onClick={() => onSelect(item.id)}
          onMouseEnter={() => onSelect(item.id)}
          onFocus={() => onSelect(item.id)}
          className="w-full rounded-xl px-2 py-2 text-left text-app-secondary transition-colors duration-200 hover:bg-app-muted hover:text-app-ink focus-visible:bg-app-muted"
        >
          <span className="flex min-h-8 items-center gap-3">
            <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-app-accent">{index + 1}</span>
            <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${selectedId === item.id ? 'text-app-accent' : ''}`}>{item.name}</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums">{percentageLabel(item.percentage)}</span>
          </span>
          <span className="ml-9 block h-1 overflow-hidden rounded-full bg-app-muted" aria-hidden="true">
            <motion.i
              className="block h-full rounded-full bg-app-action"
              animate={{ width: `${Math.max(5, item.percentage)}%`, opacity: 0.28 + item.intensity * 0.72 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
            />
          </span>
        </button>
      </li>)}
    </ol>
    {additional.length > 0 && <Disclosure
      label={`Ver mais ${additional.length} ${additional.length === 1 ? 'categoria' : 'categorias'}`}
      openLabel="Ocultar categorias"
      className="history-category-more mt-4"
      buttonClassName="text-xs text-app-secondary"
      contentClassName="history-values-content"
    >
      <ChartDataTable
        label="Categorias adicionais da distribuição muscular"
        columns={[
          { key: 'category', label: 'Categoria' },
          { key: 'count', label: 'Aparições', numeric: true },
          { key: 'percentage', label: 'Participação', numeric: true, primary: true },
        ]}
        rows={additional.map((item) => ({
          id: item.id,
          cells: {
            category: { value: item.name },
            count: { value: numberLabel(item.count) },
            percentage: { value: percentageLabel(item.percentage) },
          },
        }))}
      />
    </Disclosure>}
  </>
}

export default function MuscleDistribution({ distribution }) {
  const [selectedId, setSelectedId] = useState(distribution.items[0]?.id || null)
  useEffect(() => {
    if (!distribution.items.some((item) => item.id === selectedId)) setSelectedId(distribution.items[0]?.id || null)
  }, [distribution.items, selectedId])
  const selected = useMemo(() => distribution.items.find((item) => item.id === selectedId) || distribution.items[0] || null, [distribution.items, selectedId])

  return <Card as="section" hover={false} className="flex min-w-0 flex-col p-4 sm:p-6 xl:col-span-2" aria-labelledby="history-muscle-title">
    <div className="mb-6">
      <div><h2 id="history-muscle-title" className={ui.sectionTitle}>Distribuição muscular</h2><p className={ui.sectionSubtitle}>Presença dos exercícios concluídos no período.</p></div>
    </div>
    {!selected ? <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-4 text-center text-app-secondary"><Layers3 size={24} aria-hidden="true" /><p className="max-w-sm text-sm leading-relaxed">Ainda não há dados suficientes para montar sua distribuição muscular.</p></div> : <>
      <div className="mb-5 flex items-end justify-between gap-4" aria-live="polite">
        <div className="min-w-0">
          <span className="text-xs text-app-secondary">Categoria selecionada</span>
          <strong className="mt-1 block truncate text-xl font-semibold tracking-tight text-app-ink">{selected.name}</strong>
        </div>
        <div className="shrink-0 text-right"><b className="block text-xl font-semibold tabular-nums text-app-accent">{percentageLabel(selected.percentage)}</b><small className="mt-1 block text-xs text-app-secondary">{occurrenceLabel(selected.count)}</small></div>
      </div>
      <CategoryBreakdown items={distribution.items} selectedId={selected.id} onSelect={setSelectedId} />
    </>}
    {!distribution.reliable && <p className="mt-5 text-xs leading-relaxed text-app-secondary">{occurrenceLabel(distribution.unresolved)} sem categoria ou confirmação suficiente ficaram fora dos percentuais.</p>}
  </Card>
}
