import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CalendarDays, Clock3, Dumbbell, Layers3 } from 'lucide-react'

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
        <HistoryCard as="article" className={`history-metric history-metric-workouts ${numberLabel(stats.workouts).length > 7 ? 'history-value-long' : ''}`}>
          <div className="history-metric-top"><span>No período</span><Dumbbell size={26} aria-hidden="true" /></div>
          <div className="history-metric-base">
            <dl><dt>Quantidade de treinos</dt><dd><AnimatedValue identity={`${period}-workouts-${stats.workouts}`}><HistoryMetricValue value={numberLabel(stats.workouts)} /></AnimatedValue></dd></dl>
            <p className="history-metric-context">Sessões concluídas no período</p>
            {!stats.reliability.workouts && <small className="history-metric-note">Dados parciais</small>}
          </div>
        </HistoryCard>
        <HistoryCard as="article" tone="accent" className="history-metric history-metric-averageDuration">
          <div className="history-metric-top"><span>Por sessão</span><Clock3 size={26} aria-hidden="true" /></div>
          <div className="history-metric-base">
            <dl><dt>Duração média</dt><dd><AnimatedValue identity={`${period}-duration-${stats.averageDuration}`}>
              <HistoryMetricValue value={formatAverageWorkoutDuration(stats.workouts ? stats.averageDuration : null)} balanceDecimal />
            </AnimatedValue></dd></dl>
            <p className="history-metric-context">{stats.workouts ? 'Tempo médio por sessão' : 'Sem treinos no período'}</p>
            {!stats.reliability.averageDuration && <small className="history-metric-note">Dados parciais</small>}
          </div>
        </HistoryCard>
        <HistoryCard as="article" className="history-metric history-metric-week">
          <div className="history-metric-top"><span>Semana atual</span><CalendarDays size={26} aria-hidden="true" /></div>
          <div className="history-metric-base">
            <dl><dt>Dias nesta semana<span className="history-metric-context">Atividade na semana atual</span></dt><dd><AnimatedValue identity={`week-${stats.weekActiveDays}`}><HistoryMetricValue value={`${numberLabel(stats.weekActiveDays)} ${stats.weekActiveDays === 1 ? 'dia' : 'dias'}`} /></AnimatedValue></dd></dl>
          </div>
        </HistoryCard>
        <HistoryCard as="article" className={`history-metric history-metric-exercises ${numberLabel(stats.exercises).length > 7 ? 'history-value-long' : ''}`}>
          <div className="history-metric-top"><span>No período</span><Layers3 size={26} aria-hidden="true" /></div>
          <div className="history-metric-base">
            <dl><dt>Exercícios realizados<span className="history-metric-context">Execuções no período</span></dt><dd><AnimatedValue identity={`${period}-exercises-${stats.exercises}`}><HistoryMetricValue value={numberLabel(stats.exercises)} /></AnimatedValue></dd></dl>
            {!stats.reliability.exercises && <small className="history-metric-note">Dados parciais</small>}
          </div>
        </HistoryCard>
      </div>
      {stats.partial && <p className="history-partial-note">Alguns registros antigos estão incompletos. Métricas afetadas aparecem como parciais ou indisponíveis.</p>}
    </section>
  </>
}
