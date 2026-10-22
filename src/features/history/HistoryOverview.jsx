import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CalendarCheck2, ClipboardCheck, Dumbbell, Timer } from 'lucide-react'

import HistoryCard from './HistoryCard.jsx'
import HistoryMetricValue from './HistoryMetricValue.jsx'
import PageHeader from '../../components/ui/PageHeader.jsx'
import SegmentedControl from '../../components/ui/SegmentedControl.jsx'
import { ui } from '../../styles/theme.js'
import { numberLabel, PERIODS } from './historyModel.js'
import { formatAverageWorkoutDuration } from '../../utils/workoutDuration.js'

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

export default function HistoryOverview({ stats, period, onPeriodChange, demonstration }) {
  const periodOptions = Object.entries(PERIODS).map(([value, option]) => ({ value, label: option.label }))
  const periodScope = period === 'all' ? 'Todo o histórico' : 'Últimos 30 dias'
  const metrics = [
    { key: 'workouts', icon: ClipboardCheck, label: 'Treinos', value: numberLabel(stats.workouts), context: 'Concluídos no período', scope: periodScope, reliable: stats.reliability.workouts },
    { key: 'averageDuration', icon: Timer, label: 'Duração média', value: formatAverageWorkoutDuration(stats.workouts ? stats.averageDuration : null), context: stats.workouts ? 'Por sessão concluída' : 'Sem treinos no período', scope: periodScope, reliable: stats.reliability.averageDuration },
    { key: 'week', icon: CalendarCheck2, label: 'Dias de treino', value: `${numberLabel(stats.weekActiveDays)} ${stats.weekActiveDays === 1 ? 'dia' : 'dias'}`, context: 'Desde domingo', scope: 'Semana atual', reliable: true },
    { key: 'exercises', icon: Dumbbell, label: 'Exercícios', value: numberLabel(stats.exercises), context: 'Execuções registradas', scope: periodScope, reliable: stats.reliability.exercises },
  ]

  return <>
    <div className="history-header">
    <PageHeader title="Histórico" subtitle="Entenda sua evolução e seus treinos ao longo do tempo." stackUntilWide>
      <div className="history-period-controls">
        <div className="history-period-actions">
          <SegmentedControl
            value={period}
            options={periodOptions}
            onChange={onPeriodChange}
            ariaLabel="Período do histórico"
            layoutId="history-period-indicator"
            className="history-period-selector"
          />
        </div>
        {demonstration ? <span className="text-right text-xs text-app-secondary">Dados de demonstração</span> : null}
      </div>
    </PageHeader>
    </div>

    <section aria-label="Visão geral do histórico">
      <div className="history-overview-grid">
        {metrics.map(({ key, icon: Icon, label, value, context, scope, reliable }) => <HistoryCard as="article" key={key} className={`history-metric history-metric-${key} ${value.replace(/\D/g, '').length > 7 ? 'history-value-long' : ''}`}>
          <dl>
            <dt>
              <span className="history-metric-heading"><span className="history-metric-label">{label}</span><span className="history-metric-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span></span>
            </dt>
            <dd>
              <AnimatedValue identity={`${period}-${key}-${value}`}><HistoryMetricValue value={value} balanceDecimal={key === 'averageDuration'} /></AnimatedValue>
            </dd>
          </dl>
          <p className="history-metric-context">{context}</p>
          <div className="history-metric-footer">
            <span className="history-metric-scope">{scope}</span>
            {!reliable && <small className="history-metric-note">Dados parciais</small>}
          </div>
        </HistoryCard>)}
      </div>
      {stats.partial && <p className="history-partial-note">Alguns registros antigos estão incompletos. Métricas afetadas aparecem como parciais ou indisponíveis.</p>}
    </section>
  </>
}
