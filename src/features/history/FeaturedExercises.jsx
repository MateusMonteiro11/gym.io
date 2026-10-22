import { useId, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { ChartColumn } from 'lucide-react'
import HistoryCard from './HistoryCard.jsx'
import SegmentedControl from '../../components/ui/SegmentedControl.jsx'
import Disclosure from '../../components/ui/Disclosure.jsx'
import ChartDataTable from './ChartDataTable.jsx'
import { ui } from '../../styles/theme.js'
import { numberLabel } from './historyModel.js'

const modes = [{ value: 'load', label: 'Maiores cargas' }, { value: 'frequency', label: 'Mais realizados' }]
const valueLabel = (item, frequency) => frequency
  ? `${numberLabel(item.sessionCount)} ${item.sessionCount === 1 ? 'sessão' : 'sessões'}`
  : `${numberLabel(item.weight, 2)} kg`

function ExerciseBar({ x, y, width, height, payload, fill, selected, onSelect }) {
  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(payload.id)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const bars = [...event.currentTarget.closest('svg').querySelectorAll('[data-exercise-bar]')]
      const next = bars.indexOf(event.currentTarget) + (event.key === 'ArrowRight' ? 1 : -1)
      bars[(next + bars.length) % bars.length]?.focus()
    } else if (event.key === 'Escape') onSelect(null)
  }
  return <g tabIndex={0} role="button" aria-label={`${payload.name}: ${payload.formattedValue}`}
    aria-pressed={selected} data-exercise-bar={payload.id} className="history-exercise-bar"
    onFocus={() => onSelect(payload.id)} onMouseEnter={() => onSelect(payload.id)}
    onClick={() => onSelect(payload.id)} onKeyDown={onKeyDown}>
    <Rectangle x={x} y={y} width={width} height={height} radius={[8, 8, 0, 0]} fill={fill}
      stroke={selected ? 'var(--history-bar-outline)' : 'transparent'} strokeWidth={1} />
    <rect x={x} y={y} width={width} height={Math.max(height, 24)} fill="transparent" />
  </g>
}

export default function FeaturedExercises({ data, mode = 'load', onModeChange }) {
  const [selectedId, setSelectedId] = useState(null)
  const [width, setWidth] = useState(0)
  const id = useId().replace(/[^a-z0-9_-]/gi, '')
  const frequency = mode === 'frequency'
  const items = (frequency ? data.mostPerformed : data.highestLoads).slice(0, 5)
    .map((item) => ({ ...item, value: frequency ? item.sessionCount : item.weight, formattedValue: valueLabel(item, frequency) }))
  const selected = items.find((item) => item.id === selectedId)
  const partial = frequency ? data.partial.occurrences : data.partial.loads
  const emptyMessage = frequency ? 'Nenhum exercício concluído no período' : 'Nenhuma carga registrada no período'
  const description = frequency ? 'Presença em treinos concluídos · sessões' : 'Maior carga por exercício · kg'
  const labelLimit = Math.max(4, Math.min(15, Math.floor((width - 56) / Math.max(1, items.length) / 6.5)))

  return <HistoryCard as="section" className="history-featured" aria-labelledby={`exercises-title-${id}`}>
    <div className="history-section-heading history-ranking-heading">
      <h2 id={`exercises-title-${id}`} className={ui.sectionTitle}>Exercícios</h2>
      <SegmentedControl value={mode} options={modes} onChange={(value) => { setSelectedId(null); onModeChange(value) }}
        ariaLabel="Comparar exercícios" layoutId={`exercise-ranking-${id}`} />
    </div>
    {items.length ? <>
      <div className="history-ranking-insight" aria-live="polite">
        {selected ? <div role="tooltip"><span>{selected.name}</span><strong>{selected.formattedValue}</strong></div>
          : <p>{description}</p>}
      </div>
      <div className="history-ranking-chart" aria-label={`${description}. Use Tab e as setas para consultar cada coluna.`}
        onPointerLeave={(event) => { if (event.pointerType === 'mouse') setSelectedId(null) }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} onResize={setWidth}>
          <BarChart data={items} margin={{ top: 12, right: 8, left: 0, bottom: 8 }} barCategoryGap="28%">
            <defs><linearGradient id={`exercise-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--history-bar-start)" />
              <stop offset="100%" stopColor="var(--history-bar-end)" />
            </linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--history-grid)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tickMargin={14} height={48}
              tick={{ fill: 'var(--history-muted)', fontSize: 11 }}
              tickFormatter={(name) => name.length > labelLimit ? `${name.slice(0, labelLimit - 1).trim()}…` : name} />
            <YAxis axisLine={false} tickLine={false} allowDecimals={!frequency} width={42}
              tick={{ fill: 'var(--history-muted)', fontSize: 12 }} tickFormatter={(value) => numberLabel(value, frequency ? 0 : 1)} />
            <Bar dataKey="value" maxBarSize={64} fill={`url(#exercise-fill-${id})`} isAnimationActive={false}
              shape={(props) => <ExerciseBar {...props} selected={selectedId === props.payload.id} onSelect={setSelectedId} />} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Disclosure label="Ver dados dos exercícios" openLabel="Ocultar dados dos exercícios" className="history-values" contentClassName="history-values-content">
        <ChartDataTable label={`Exercícios · ${frequency ? 'mais realizados' : 'maiores cargas'}`} columns={[
          { key: 'exercise', label: 'Exercício' },
          { key: 'value', label: frequency ? 'Sessões' : 'Carga máxima', numeric: true, primary: true },
        ]} rows={items.map((item) => ({ id: item.id, cells: { exercise: { value: item.name }, value: { value: item.formattedValue } } }))} />
      </Disclosure>
    </> : <div className="history-chart-empty is-compact"><ChartColumn size={25} aria-hidden="true" /><p>{emptyMessage}</p><span>Os exercícios aparecerão aqui conforme seus registros concluídos.</span></div>}
    {partial && <p className="history-partial-note">Registros incompletos podem não aparecer neste gráfico. Dados parciais.</p>}
  </HistoryCard>
}
