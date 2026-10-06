import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import Card from '../../components/ui/Card.jsx'
import SegmentedControl from '../../components/ui/SegmentedControl.jsx'
import { ui } from '../../styles/theme.js'
import { OverviewTrendChart } from './HistoryCharts.jsx'
import { TREND_METRICS } from './historyModel.js'

const DESCRIPTIONS = {
  workouts: 'Treinos concluídos em cada intervalo.',
  duration: 'Duração média dos treinos em cada intervalo.',
  exercises: 'Exercícios realizados em cada intervalo.',
}

export default function TrainingRhythm({ data, metric, onMetricChange }) {
  const reduceMotion = useReducedMotion()
  const options = Object.entries(TREND_METRICS).map(([value, option]) => ({ value, label: option.label }))

  return <Card as="section" hover={false} className="min-w-0 overflow-hidden p-4 sm:p-6 xl:col-span-3" aria-labelledby="history-trend-title">
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 id="history-trend-title" className={ui.sectionTitle}>Ritmo de treino</h2>
        <p className={ui.sectionSubtitle}>{DESCRIPTIONS[metric]}</p>
      </div>
      <SegmentedControl
        value={metric}
        options={options}
        onChange={onMetricChange}
        ariaLabel="Métrica do ritmo de treino"
        layoutId="history-trend-indicator"
        className="w-full [&>button]:flex-1 lg:w-auto"
      />
    </div>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        className="history-chart-crossfade"
        key={metric}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: 'easeOut' }}
      ><OverviewTrendChart data={data} metric={metric} /></motion.div>
    </AnimatePresence>
  </Card>
}
