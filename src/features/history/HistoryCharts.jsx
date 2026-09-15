import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartNoAxesCombined } from 'lucide-react'
import Disclosure from '../../components/ui/Disclosure.jsx'
import {
  compactNumberLabel,
  getTrendMetricValue,
  hasSufficientTrendData,
  isTrendBucketPopulated,
  numberLabel,
  shortDate,
  timeLabel,
  TREND_METRICS,
} from './historyModel.js'

function metricValue(value, metric) {
  if (value == null) return '—'
  if (metric === 'duration') return `${numberLabel(value / 60, 1)} min`
  return numberLabel(value, 1)
}

function axisValue(value, metric) {
  return metric === 'duration' ? compactNumberLabel(value / 60) : compactNumberLabel(value)
}

function metricReliable(point, metric) {
  if (!point.reliability) return !point.partialData
  if (metric === 'duration') return point.reliability.averageDuration
  if (metric === 'exercises') return point.reliability.exerciseCount
  return point.reliability.workouts
}

function TrendTooltip({ active, payload, metric }) {
  const point = payload?.find((item) => item.payload)?.payload
  if (!active || !point) return null
  return <div className="history-tooltip" role="status">
    <span>{point.label}</span>
    <strong>{metricValue(point.value, metric)}</strong>
    <small>{point.workouts} {point.workouts === 1 ? 'treino' : 'treinos'}{point.isPartial ? ' · período parcial' : ''}{point.partialData ? ' · dados parciais' : ''}</small>
  </div>
}

export function OverviewTrendChart({ data, metric }) {
  const variable = TREND_METRICS[metric]
  const chartData = data.map((point) => {
    const value = getTrendMetricValue(point, metric)
    return {
      ...point,
      value,
      chartValue: value == null ? null : metric === 'duration' ? value / 60 : value,
      partialData: !metricReliable(point, metric),
    }
  })
  const hasTrend = hasSufficientTrendData(data, metric)
  const knownPoint = [...data].reverse().find((point) => isTrendBucketPopulated(point, metric)) || null
  const firstObservedPoint = chartData.find((point) => point.chartValue != null) || null
  const durationOriginGuide = metric === 'duration'
    && firstObservedPoint
    && firstObservedPoint.timestamp !== chartData[0]?.timestamp
    ? [
        { x: chartData[0].timestamp, y: 0 },
        { x: firstObservedPoint.timestamp, y: firstObservedPoint.chartValue },
      ]
    : null
  const tickEvery = Math.max(1, Math.ceil(chartData.length / 6))
  const ticks = chartData.filter((_, index) => index === chartData.length - 1 || index % tickEvery === 0).map((point) => point.timestamp)

  return <>
    {hasTrend ? <div className="history-primary-chart" aria-label={`${variable.label} por período. Use Tab e as setas no gráfico para consultar os pontos.${durationOriginGuide ? ' O trecho pontilhado parte da origem e conduz ao primeiro intervalo com duração registrada.' : ''}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={chartData} accessibilityLayer margin={{ top: 18, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--history-grid)" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={ticks} interval="preserveStartEnd" minTickGap={18} axisLine={false} tickLine={false} tick={{ fill: 'var(--history-muted)', fontSize: 11 }} tickMargin={12} tickFormatter={(value) => chartData.find((point) => point.timestamp === value)?.label || ''} />
          <YAxis domain={[0, 'auto']} allowDecimals={metric !== 'workouts'} axisLine={false} tickLine={false} tick={{ fill: 'var(--history-muted)', fontSize: 11 }} tickFormatter={(value) => axisValue(metric === 'duration' ? value * 60 : value, metric)} width={66} />
          <Tooltip trigger="click" content={<TrendTooltip metric={metric} />} cursor={{ stroke: 'var(--history-muted)', strokeDasharray: '3 5' }} />
          {durationOriginGuide ? <ReferenceLine segment={durationOriginGuide} stroke="var(--history-chart-blue)" strokeWidth={3} strokeOpacity={0.42} strokeDasharray="5 5" /> : null}
          <Area type="monotone" dataKey="chartValue" fill="var(--history-chart-fill)" stroke="none" connectNulls={false} isAnimationActive={false} tooltipType="none" />
          <Line type="monotone" dataKey="chartValue" name={variable.label} stroke="var(--history-chart-blue)" strokeWidth={3} connectNulls={false} dot={{ r: 3.5, fill: 'var(--history-surface)', stroke: 'var(--history-chart-blue)', strokeWidth: 2 }} activeDot={{ r: 5.5, fill: 'var(--history-chart-blue)', stroke: 'var(--history-surface)', strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div> : <div className="history-chart-empty is-compact"><ChartNoAxesCombined size={25} aria-hidden="true" /><p>Ainda não há dados suficientes para mostrar uma tendência.</p><span>Continue registrando seus treinos para comparar diferentes períodos.</span>{knownPoint ? <small className="history-known-value"><span>Último período com dados</span><strong>{knownPoint.label} · {metricValue(getTrendMetricValue(knownPoint, metric), metric)}</strong></small> : null}</div>}
    <Disclosure
      label="Ver dados do gráfico"
      openLabel="Ocultar dados do gráfico"
      className="history-values"
      contentClassName="history-values-table"
    >
      <table><caption className="history-sr-only">Dados de {variable.label.toLowerCase()} por período</caption><thead><tr><th>Período</th><th>{variable.label}</th><th>Treinos</th></tr></thead><tbody>{data.map((point) => {
        const value = getTrendMetricValue(point, metric)
        return <tr key={point.key}><td>{point.label}{point.isPartial && <small>Período parcial</small>}</td><td>{metricValue(value, metric)}{!metricReliable(point, metric) && <small>Dados parciais</small>}</td><td>{point.workouts}</td></tr>
      })}</tbody></table>
    </Disclosure>
  </>
}

function EvolutionTooltip({ active, payload }) {
  const point = payload?.find((item) => item.payload)?.payload
  if (!active || !point) return null
  return <div className="history-tooltip" role="status">
    <span>{shortDate(new Date(point.timestamp))} · {timeLabel(new Date(point.timestamp))}</span>
    <strong>{numberLabel(point.value, 2)} <small>kg{point.reps != null && ` · ${numberLabel(point.reps)} rep`}</small></strong>
    {point.partial && <small>Registro incompleto</small>}
  </div>
}

function loadDomain(points) {
  const values = points.map((point) => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum
  const padding = Math.max(2.5, span * 0.12, maximum * 0.04)
  const lower = minimum <= padding * 1.5 ? 0 : Math.max(0, minimum - padding)
  return [Math.floor(lower * 10) / 10, Math.ceil((maximum + padding) * 10) / 10]
}

export function ExerciseTrendChart({ points }) {
  const chartKey = points.map((point) => `${point.sessionId}/${point.timestamp}/${point.value}/${point.reps}/${point.partial}`).join('|')
  const valid = points.filter((point) => point.value != null)
  const dates = valid.map((point) => point.timestamp)
  const domain = dates.length > 1 ? [dates[0], dates.at(-1)] : [dates[0] ?? 0, (dates[0] ?? 0) + 1]
  const ticks = dates.filter((_, index) => dates.length <= 6 || index === dates.length - 1 || index % Math.ceil((dates.length - 1) / 5) === 0)
  const sameDay = dates.length > 1 && new Date(dates[0]).toDateString() === new Date(dates.at(-1)).toDateString()

  return <>
    {valid.length >= 2 ? <div className="history-exercise-chart" aria-label="Maior carga registrada por sessão. Use Tab e as setas no gráfico para consultar os pontos.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart key={chartKey} data={valid} accessibilityLayer margin={{ top: 18, right: 10, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke="var(--history-grid)" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={domain} ticks={ticks} axisLine={false} tickLine={false} tick={{ fill: 'var(--history-muted)', fontSize: 11 }} tickMargin={12} minTickGap={12} tickFormatter={(value) => sameDay ? timeLabel(new Date(value)) : shortDate(new Date(value))} />
          <YAxis domain={loadDomain(valid)} allowDecimals axisLine={false} tickLine={false} tick={{ fill: 'var(--history-muted)', fontSize: 11 }} tickFormatter={(value) => compactNumberLabel(value)} width={62} />
          <Tooltip trigger="click" defaultIndex={valid.length - 1} content={<EvolutionTooltip />} cursor={{ stroke: 'var(--history-muted)', strokeDasharray: '3 5' }} />
          <Area type="monotone" dataKey="value" fill="var(--history-chart-fill)" stroke="none" isAnimationActive={false} tooltipType="none" />
          <Line type="monotone" dataKey="value" name="Carga" stroke="var(--history-chart-blue)" strokeWidth={3} dot={valid.length <= 80 ? { r: 4, fill: 'var(--history-surface)', stroke: 'var(--history-chart-blue)', strokeWidth: 2.25 } : false} activeDot={{ r: 6, fill: 'var(--history-chart-blue)', stroke: 'var(--history-surface)', strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div> : <div className="history-chart-empty"><ChartNoAxesCombined size={25} aria-hidden="true" /><p>{valid.length === 1 ? 'Esta é a primeira referência de carga.' : 'Ainda não há cargas concluídas.'}</p><span>{valid.length === 1 ? 'Mais treinos são necessários para visualizar a evolução deste exercício.' : 'As próximas sessões deste exercício aparecerão aqui.'}</span></div>}
    <p className="history-chart-description">Maior carga concluída em cada sessão.</p>
    <Disclosure
      label="Ver registros do gráfico"
      openLabel="Ocultar registros do gráfico"
      className="history-values"
      contentClassName="history-values-table"
    >
      <table><caption className="history-sr-only">Registros de carga</caption><thead><tr><th>Sessão</th><th>Carga</th><th>Repetições</th></tr></thead><tbody>{points.map((point) => <tr key={point.sessionId}><td>{new Date(point.timestamp).toLocaleDateString('pt-BR')}<small>{timeLabel(new Date(point.timestamp))}</small></td><td>{numberLabel(point.value, 2)}{point.value != null && ' kg'}{point.partial && <small>Parcial</small>}</td><td>{numberLabel(point.reps)}</td></tr>)}</tbody></table>{!points.length && <p>Sem registros neste período.</p>}
    </Disclosure>
  </>
}
