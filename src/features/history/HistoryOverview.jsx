import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

import Card from '../../components/ui/Card.jsx'
import PageHeader from '../../components/ui/PageHeader.jsx'
import SegmentedControl from '../../components/ui/SegmentedControl.jsx'
import { ui } from '../../styles/theme.js'
import { durationLabel, numberLabel, PERIODS } from './historyModel.js'

const METRICS = [
  { key: 'workouts', label: 'Treinos' },
  { key: 'exercises', label: 'Exercícios realizados' },
  { key: 'averageDuration', label: 'Duração média' },
]

function metricValue(key, value) {
  if (value == null) return '—'
  return key === 'averageDuration' ? durationLabel(value) : numberLabel(value)
}

function AnimatedValue({ identity, children }) {
  const reduceMotion = useReducedMotion()
  return <AnimatePresence mode="wait" initial={false}>
    <motion.span
      key={identity}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -3 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.16, ease: 'easeOut' }}
    >{children}</motion.span>
  </AnimatePresence>
}

export default function HistoryOverview({ stats, period, onPeriodChange, onRefresh, demonstration }) {
  const weekLabel = `${numberLabel(stats.weekActiveDays)} ${stats.weekActiveDays === 1 ? 'dia' : 'dias'}`
  const periodOptions = Object.entries(PERIODS).map(([value, option]) => ({ value, label: option.label }))

  return <>
    <PageHeader title="Histórico" subtitle="Entenda sua evolução e seus treinos ao longo do tempo." stackUntilWide>
      <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
        <div className="flex w-fit max-w-full items-center justify-end gap-2 self-end">
          <SegmentedControl
            value={period}
            options={periodOptions}
            onChange={onPeriodChange}
            ariaLabel="Período do histórico"
            layoutId="history-period-indicator"
            className="flex-none"
          />
          <button
            type="button"
            className={`${ui.iconBtn} h-11 w-11 shrink-0 rounded-xl`}
            aria-label="Atualizar histórico"
            onClick={onRefresh}
          >
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        </div>
        {demonstration ? <span className="text-right text-xs text-slate-500 dark:text-slate-400">Dados de demonstração</span> : null}
      </div>
    </PageHeader>

    <Card as="section" hover={false} className="p-6 sm:p-8" aria-label="Visão geral do histórico">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRICS.map(({ key, label }) => <div className="min-w-0 rounded-xl bg-primary-muted p-3 dark:bg-primary/10 sm:p-4" key={key}>
            <dt className="text-xs font-medium text-primary dark:text-blue-300">{label}</dt>
            <dd className="mt-2 whitespace-nowrap text-xl font-semibold tracking-tight text-primary dark:text-blue-300 sm:text-3xl">
              <AnimatedValue identity={`${period}-${key}-${stats[key]}`}>{metricValue(key, stats[key])}</AnimatedValue>
            </dd>
            {!stats.reliability[key] ? <small className="mt-1 block text-xs text-primary/70 dark:text-blue-300/70">Dados parciais</small> : null}
          </div>)}
        <div className="min-w-0 rounded-xl bg-primary-muted p-3 dark:bg-primary/10 sm:p-4">
          <dt className="text-xs font-medium text-primary dark:text-blue-300">Dias esta semana</dt>
          <dd className="mt-2 whitespace-nowrap text-xl font-semibold tracking-tight text-primary dark:text-blue-300 sm:text-3xl">
            <AnimatedValue identity={`week-${stats.weekActiveDays}`}>{weekLabel}</AnimatedValue>
          </dd>
          <small className="mt-1 block text-xs text-primary/70 dark:text-blue-300/70">semana atual</small>
        </div>
      </dl>

      {stats.partial ? <p className="mt-6 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Alguns registros antigos estão incompletos. Métricas afetadas aparecem como parciais ou indisponíveis.</p> : null}
    </Card>
  </>
}
