import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useState } from 'react'
import { ChartNoAxesCombined } from 'lucide-react'
import Disclosure from '../../components/ui/Disclosure.jsx'
import ChartDataTable from './ChartDataTable.jsx'
import { HISTORY_LIMITS } from './historyLimits.js'
import { averageDurationNumberLabel, compactAverageDurationNumberLabel } from '../../utils/workoutDuration.js'
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
  if (metric === 'duration') return `${averageDurationNumberLabel(value / 60)} min`
  return numberLabel(value, 1)
}

function axisValue(value, metric) {
  return metric === 'duration' ? compactAverageDurationNumberLabel(value / 60) : compactNumberLabel(value)
}

function metricReliable(point, metric) {
  if (!point.reliability) return !point.partialData
  if (metric === 'duration') return point.reliability.totalDuration
  if (metric === 'exercises') return point.reliability.exerciseCount
  return point.reliability.workouts
}

function responsiveTicks(timestamps, width) {
  const dates = [...new Set(timestamps)]
  const count = width < 480 ? 3 : width < 800 ? 4 : 6
  if (dates.length <= count) return dates
  return Array.from({ length: count }, (_, index) => dates[Math.round(index * (dates.length - 1) / (count - 1))])
}

function TrendTooltip({ active, payload, metric }) {
  const point = payload?.find((item) => item.payload)?.payload
  if (!active || !point) return null
  return <div className="history-tooltip" role="status">
    <span>{point.label}</span>
    <strong>{metricValue(point.value, metric)}</strong>
    <small>{point.workouts} {point.workouts === 1 ? 'treino' : 'treinos'}{point.partialData ? ' · dados parciais' : ''}</small>
  </div>
}

export function OverviewTrendChart({ data, metric }) {
  const [chartWidth, setChartWidth] = useState(0)
  const compact = chartWidth < 640
  const variable = TREND_METRICS[metric]
  const metricLabel = metric === 'duration' ? 'Duração total' : variable.label
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
  const ticks = responsiveTicks(chartData.map((point) => point.timestamp), chartWidth)

  return <>
    {hasTrend ? <div className="history-primary-chart" aria-label={`${variable.label} por período. Use Tab e as setas no gráfico para consultar os pontos.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} onResize={setChartWidth}>
        <ComposedChart data={chartData} accessibilityLayer margin={{ top: 18, right: compact ? 4 : 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--history-grid)" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={ticks} padding={{ left: compact ? 8 : 12, right: compact ? 8 : 12 }} interval="preserveStartEnd" minTickGap={18} axisLine={false} tickLine={false} tick={{ fill: 'var(--history-muted)', fontSize: 12 }} tickMargin={12} tickFormatter={(value) => chartWidth < 480 ? shortDate(new Date(value)) : chartData.find((point) => point.timestamp === value)?.label || ''} />
          <YAxis domain={[0, 'auto']} allowDecimals={metric === 'duration'} axisLine={false} tickLine={false} tickSize={compact ? 0 : 6} tickMargin={2} tick={{ fill: 'var(--history-muted)', fontSize: 12 }} tickFormatter={(value) => axisValue(metric === 'duration' ? value * 60 : value, metric)} width="auto" />
          <Tooltip trigger="click" content={<TrendTooltip metric={metric} />} cursor={{ stroke: 'var(--history-muted)', strokeDasharray: '3 5' }} />
          <Area type="monotone" dataKey="chartValue" fill="var(--history-chart-fill)" stroke="none" connectNulls={false} isAnimationActive={false} tooltipType="none" />
          <Line type="monotone" dataKey="chartValue" name={metricLabel} stroke="var(--history-chart-blue)" strokeWidth={3} connectNulls={false} dot={{ r: 3.5, fill: 'var(--history-surface)', stroke: 'var(--history-chart-blue)', strokeWidth: 2 }} activeDot={{ r: 5.5, fill: 'var(--history-chart-blue)', stroke: 'var(--history-surface)', strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div> : <div className="history-chart-empty is-compact"><ChartNoAxesCombined size={25} aria-hidden="true" /><p>Ainda não há dados suficientes para mostrar uma tendência.</p><span>Continue registrando seus treinos para comparar diferentes períodos.</span>{knownPoint ? <small className="history-known-value"><span>Último período com dados</span><strong>{knownPoint.label} · {metricValue(getTrendMetricValue(knownPoint, metric), metric)}</strong></small> : null}</div>}
    {metric === 'duration' && chartData.some((point) => point.partialData) && <p className="history-partial-note">Algumas durações não foram registradas. Os totais disponíveis são parciais.</p>}
    <Disclosure
      label="Ver dados do gráfico"
      openLabel="Ocultar dados do gráfico"
      className="history-values"
      contentClassName="history-values-content"
    >
      <ChartDataTable
        label={`Dados de ${metricLabel.toLowerCase()} por período`}
        columns={[
          { key: 'period', label: 'Período' },
          { key: 'metric', label: metricLabel, numeric: true, primary: true },
          ...(metric === 'workouts' ? [] : [{ key: 'workouts', label: 'Treinos', numeric: true }]),
        ]}
        rows={data.map((point) => ({
          id: point.key,
          cells: {
            period: { value: point.label },
            metric: {
              value: metricValue(getTrendMetricValue(point, metric), metric),
              note: !metricReliable(point, metric) ? 'Dados parciais' : null,
            },
            workouts: { value: numberLabel(point.workouts) },
          },
        }))}
      />
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
  const minimum = points.reduce((value, point) => Math.min(value, point.value), Infinity)
  const maximum = points.reduce((value, point) => Math.max(value, point.value), -Infinity)
  const span = maximum - minimum
  const padding = Math.max(2.5, span * 0.12, maximum * 0.04)
  const lower = minimum <= padding * 1.5 ? 0 : Math.max(0, minimum - padding)
  return [Math.floor(lower * 10) / 10, Math.ceil((maximum + padding) * 10) / 10]
}

export function ExerciseTrendChart({ points }) {
  const [chartWidth, setChartWidth] = useState(0)
  const displayed = points.slice(-HISTORY_LIMITS.evolutionPoints)
  const chartKey = displayed.map((point) => `${point.sessionId}/${point.timestamp}/${point.value}/${point.reps}/${point.partial}`).join('|')
  const valid = displayed.filter((point) => point.value != null)
  const dates = valid.map((point) => point.timestamp)
  const domain = dates.length > 1 ? [dates[0], dates.at(-1)] : [dates[0] ?? 0, (dates[0] ?? 0) + 1]
  const ticks = responsiveTicks(dates, chartWidth)
  const sameDay = dates.length > 1 && new Date(dates[0]).toDateString() === new Date(dates.at(-1)).toDateString()

  return <>
    {valid.length >= 2 ? <div className="history-exercise-chart" aria-label="Maior carga registrada por sessão. Use Tab e as setas no gráfico para consultar os pontos.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} onResize={setChartWidth}>
        <ComposedChart key={chartKey} data={valid} accessibilityLayer margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--history-grid)" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={domain} ticks={ticks} padding={{ left: 12, right: 12 }} axisLine={false} tickLine={false} tick={{ fill: 'var(--history-muted)', fontSize: 12 }} tickMargin={12} minTickGap={12} tickFormatter={(value) => sameDay ? timeLabel(new Date(value)) : shortDate(new Date(value))} />
          <YAxis domain={loadDomain(valid)} allowDecimals axisLine={false} tickLine={false} tick={{ fill: 'var(--history-muted)', fontSize: 12 }} tickFormatter={(value) => compactNumberLabel(value)} width="auto" />
          <Tooltip trigger="click" defaultIndex={valid.length - 1} content={<EvolutionTooltip />} cursor={{ stroke: 'var(--history-muted)', strokeDasharray: '3 5' }} />
          <Area type="monotone" dataKey="value" fill="var(--history-chart-fill)" stroke="none" isAnimationActive={false} tooltipType="none" />
          <Line type="monotone" dataKey="value" name="Carga" stroke="var(--history-chart-blue)" strokeWidth={3} dot={valid.length <= 80 ? { r: 4, fill: 'var(--history-surface)', stroke: 'var(--history-chart-blue)', strokeWidth: 2.25 } : false} activeDot={{ r: 6, fill: 'var(--history-chart-blue)', stroke: 'var(--history-surface)', strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div> : <div className="history-chart-empty"><ChartNoAxesCombined size={25} aria-hidden="true" /><p>{valid.length === 1 ? 'Esta é a primeira referência de carga.' : 'Ainda não há cargas concluídas.'}</p><span>{valid.length === 1 ? 'Mais treinos são necessários para visualizar a evolução deste exercício.' : 'As próximas sessões deste exercício aparecerão aqui.'}</span></div>}
    <p className="history-chart-description">Maior carga concluída em cada sessão.</p>
    {points.length > HISTORY_LIMITS.evolutionPoints && <p className="history-data-note">O gráfico mostra as {HISTORY_LIMITS.evolutionPoints} sessões mais recentes. Os indicadores e a tabela consideram todo o período selecionado.</p>}
    <Disclosure
      label="Ver registros do gráfico"
      openLabel="Ocultar registros do gráfico"
      className="history-values"
      contentClassName="history-values-content"
    >
      <ChartDataTable
        label="Registros de carga"
        emptyMessage="Sem registros neste período."
        columns={[
          { key: 'session', label: 'Sessão' },
          { key: 'load', label: 'Carga', numeric: true, primary: true },
          { key: 'reps', label: 'Repetições', numeric: true },
        ]}
        rows={points.map((point) => ({
          id: point.sessionId,
          cells: {
            session: { value: new Date(point.timestamp).toLocaleDateString('pt-BR'), note: timeLabel(new Date(point.timestamp)) },
            load: {
              value: `${numberLabel(point.value, 2)}${point.value != null ? ' kg' : ''}`,
              note: point.partial ? 'Parcial' : null,
            },
            reps: { value: numberLabel(point.reps) },
          },
        }))}
      />
    </Disclosure>
  </>
}
