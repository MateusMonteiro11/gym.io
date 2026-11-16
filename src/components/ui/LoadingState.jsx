import { Skeleton } from './Skeleton'
import { layout } from '../../styles/layout'
import { ui } from '../../styles/theme'
import { buildExerciseHeatmap } from '../../utils/dashboardInsights'

const cardClass = ui.card

function PageHeaderSkeleton({
  eyebrow = false,
  actions = 0,
  supportingCopy = false,
  titleClassName = 'w-48',
  className = 'mb-8',
}) {
  const layoutClass = eyebrow
    ? 'lg:flex-row lg:items-center lg:justify-between'
    : 'sm:flex-row sm:items-end sm:justify-between'

  return (
    <div className={`${className} flex flex-col gap-4 ${layoutClass}`}>
      <div>
        {eyebrow ? (
          <>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
            <div className="mt-3 flex h-9 items-center">
              <Skeleton className={`h-7 rounded-xl ${titleClassName}`} />
            </div>
            <div className="mt-2 flex h-6 items-center">
              <Skeleton className="h-3.5 w-72 max-w-[78vw] rounded-full" />
            </div>
          </>
        ) : (
          <>
            <Skeleton className={`h-9 rounded-xl ${titleClassName}`} />
            <div className="mt-1 flex h-5 items-center">
              <Skeleton className="h-3.5 w-72 max-w-[78vw] rounded-full" />
            </div>
          </>
        )}
      </div>
      {actions > 0 && (
        <div className="flex gap-3">
          {Array.from({ length: actions }, (_, index) => (
            <Skeleton key={index} className={`h-10 rounded-xl ${index === 0 ? 'w-20' : 'w-32'}`} />
          ))}
        </div>
      )}
      {supportingCopy && (
        <div className="w-full max-w-sm space-y-2 sm:w-72 sm:text-right">
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-3.5 w-3/5 rounded-full sm:ml-auto" />
        </div>
      )}
    </div>
  )
}

const dashboardCardClass = 'rounded-2xl border border-slate-200 app:border-app-line bg-white app:bg-app-surface dark:border-white/[0.08] dark:bg-[#090909]'

function DashboardMomentumSkeleton() {
  return (
    <div className="dashboard-momentum-card flex min-h-[330px] flex-col overflow-hidden rounded-2xl border p-6 sm:p-8">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <Skeleton inverse className="h-3 w-28 rounded-full" />
          <Skeleton inverse className="mt-4 h-7 w-full max-w-md rounded-lg sm:h-9" />
        </div>
        <Skeleton inverse className="h-11 w-11 shrink-0 rounded-2xl" />
      </div>

      <div className="mt-8 flex items-end gap-4">
        <Skeleton inverse className="h-16 w-20 shrink-0 rounded-xl sm:h-[4.5rem]" />
        <div className="min-w-0 flex-1 space-y-2 pb-1">
          <Skeleton inverse className="h-3.5 w-36 max-w-full rounded-full" />
          <Skeleton inverse className="h-3 w-48 max-w-full rounded-full" />
        </div>
      </div>

      <div className="mt-auto grid grid-cols-7 gap-2 pt-8">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="min-w-0 text-center">
            <Skeleton inverse className="mx-auto h-2.5 w-5 max-w-full rounded-full" />
            <Skeleton inverse className="mt-2 h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardNextActionSkeleton() {
  return (
    <div className={`${dashboardCardClass} flex min-h-[330px] flex-col p-6 sm:p-8`}>
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="mt-4 h-7 w-full max-w-xs rounded-lg" />
          <Skeleton className="mt-2 h-7 w-3/4 max-w-56 rounded-lg" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
      </div>
      <div className="mt-6 space-y-2.5">
        <Skeleton className="h-3.5 w-full max-w-sm rounded-full" />
        <Skeleton className="h-3.5 w-4/5 max-w-xs rounded-full" />
      </div>
      <Skeleton className="mt-auto h-11 w-full rounded-xl sm:w-44" />
    </div>
  )
}

function DashboardQuickMetricSkeleton() {
  return (
    <div className={`${dashboardCardClass} min-h-[178px] p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-32 rounded-full" />
          <div className="mt-5 flex items-end gap-2">
            <Skeleton className="h-9 w-16 rounded-lg" />
            <Skeleton className="mb-0.5 h-3.5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-3 w-full max-w-56 rounded-full" />
        </div>
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
      </div>
    </div>
  )
}

function DashboardHeatmapSkeleton() {
  const heatmap = buildExerciseHeatmap([])
  const cellSize = 12
  const cellGap = 4
  const chartWidth = heatmap.weeks.length * (cellSize + cellGap) - cellGap

  return (
    <div className={`${dashboardCardClass} min-w-0 w-full max-w-full p-6 sm:p-8`}>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="mt-3 h-7 w-64 max-w-full rounded-lg" />
          <Skeleton className="mt-3 h-3.5 w-full max-w-2xl rounded-full" />
          <Skeleton className="mt-2 h-3.5 w-3/4 max-w-lg rounded-full sm:hidden" />
        </div>
        <div className="min-w-0 w-full space-y-3 xl:flex xl:w-[31rem] xl:flex-col xl:items-end">
          <div className="flex w-full justify-end">
            <Skeleton className="h-11 w-20 rounded-lg" />
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className={`flex min-h-24 flex-col justify-between rounded-2xl border px-4 py-3.5 ${
                  index === 0
                    ? 'border-primary/15 app:border-app-accent/15 bg-primary/[0.055] app:bg-app-action/[0.055] dark:border-primary/25 dark:bg-primary/[0.09]'
                    : 'border-slate-200 app:border-app-line bg-slate-50 app:bg-app-muted dark:border-white/[0.08] dark:bg-white/[0.04]'
                }`}
              >
                <Skeleton className="h-2.5 w-24 rounded-full" />
                <div className="mt-3 flex items-end gap-2">
                  <Skeleton className="h-8 w-12 rounded-lg" />
                  <Skeleton className="mb-0.5 h-3 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 min-w-0 w-full max-w-full overflow-hidden pb-3">
        <div className="flex min-w-full justify-end sm:justify-start">
          <div className="w-max shrink-0 p-2" style={{ minWidth: `${chartWidth + 36 + 16}px` }}>
            <div
              className="ml-9 grid"
              style={{ gridTemplateColumns: `repeat(${heatmap.weeks.length}, ${cellSize}px)`, gap: `${cellGap}px` }}
            >
              {heatmap.monthLabels.map((label, index) => (
                <span key={`${label}-${index}`} className="h-5">
                  {label && <span className="block h-2.5 w-7 rounded-full bg-slate-200 app:bg-app-muted dark:bg-white/[0.08]" />}
                </span>
              ))}
            </div>
            <div className="mt-2 flex items-start gap-3">
              <div className="grid h-[108px] w-6 shrink-0 grid-rows-7 gap-1">
                {Array.from({ length: 7 }, (_, index) => (
                  <span key={index} className={index % 2 === 1 ? 'my-auto h-2 w-5 rounded-full bg-slate-200 app:bg-app-muted dark:bg-white/[0.08]' : ''} />
                ))}
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${heatmap.weeks.length}, ${cellSize}px)`,
                  gridTemplateRows: `repeat(7, ${cellSize}px)`,
                  gridAutoFlow: 'column',
                  gap: `${cellGap}px`,
                }}
              >
                {heatmap.days.map((day) => (
                  <span
                    key={day.key}
                    className={`rounded-[3px] ${day.isOutsideRange ? 'bg-transparent' : 'border border-slate-200 app:border-app-line bg-slate-100 app:bg-app-muted dark:border-white/[0.06] dark:bg-white/[0.06]'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 app:border-app-line pt-5 dark:border-white/[0.06]">
        <Skeleton className="h-3 w-64 max-w-full rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-10 rounded-full" />
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="h-3 w-3 rounded-[3px] border border-slate-200 app:border-app-line bg-slate-100 app:bg-app-muted dark:border-white/[0.06] dark:bg-white/[0.06]" />
          ))}
          <Skeleton className="h-3 w-8 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <PageHeaderSkeleton titleClassName="w-32" supportingCopy />
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <DashboardMomentumSkeleton />
          <DashboardNextActionSkeleton />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <DashboardQuickMetricSkeleton />
          <DashboardQuickMetricSkeleton />
        </div>
        <DashboardHeatmapSkeleton />
      </div>
    </>
  )
}

function SectionHeadingSkeleton({ action = false }) {
  return (
    <div className={`mb-6 ${action ? 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between' : 'flex items-center gap-3'}`}>
      <div className="flex min-h-[52px] items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div>
          <div className="flex h-7 items-center">
            <Skeleton className="h-5 w-44 rounded-lg" />
          </div>
          <div className="mt-1 flex h-5 items-center">
            <Skeleton className="h-3 w-56 max-w-[58vw] rounded-full" />
          </div>
        </div>
      </div>
      {action && <Skeleton className="h-10 w-32 rounded-xl" />}
    </div>
  )
}

function WorkoutCardSkeleton({ personalized = false, className = '' }) {
  return (
    <div className={`relative isolate flex min-h-[24.5rem] pt-2 ${className}`}>
      <span className={`pointer-events-none absolute inset-x-3 bottom-0 top-0 rounded-[1.75rem] ${personalized ? 'bg-slate-200 app:bg-app-muted dark:bg-[#171717]' : 'bg-primary/15 app:bg-app-action/15 dark:bg-primary/25'}`} />
      <div className="relative z-10 flex min-h-96 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 app:border-app-line/80 bg-surface app:bg-app-surface dark:border-white/[0.06] dark:bg-[#080808]">
        <div className="flex h-20 shrink-0 items-center justify-between gap-2 px-4 py-4 md:h-28 md:flex-col md:items-start md:justify-center lg:h-20 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-7 w-24 rounded-full" />
          {personalized && (
            <div className="flex items-center gap-1">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-11 w-11 rounded-full" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:pb-6">
          <Skeleton className="mb-5 h-1 w-10 rounded-full" />
          <Skeleton className="h-7 w-4/5 rounded-lg" />
          <Skeleton className="mt-2 h-7 w-3/5 rounded-lg" />
          <Skeleton className="mt-4 h-3.5 w-full rounded-full" />
          <Skeleton className="mt-2 h-3.5 w-4/5 rounded-full" />
          <Skeleton className="mt-6 h-3 w-36 rounded-full" />
          <div className="mt-auto flex items-center justify-between gap-2 pt-8">
            <Skeleton className="h-11 w-24 rounded-xl" />
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkoutGridSkeleton({ personalized = false }) {
  const visibility = ['', 'hidden sm:flex', 'hidden lg:flex', 'hidden xl:flex']

  return (
    <div className={layout.workoutsGrid}>
      {visibility.map((className, index) => (
        <WorkoutCardSkeleton key={index} personalized={personalized} className={className} />
      ))}
    </div>
  )
}

function WorkoutsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton titleClassName="w-36" />
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-primary/20 app:border-app-accent/20 bg-primary-muted/60 app:bg-app-selection/60 p-6 dark:border-white/[0.06] dark:bg-[#090909] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-48 max-w-full rounded-lg" />
            </div>
            <div className="mt-1 flex h-5 items-center">
              <Skeleton className="h-3 w-full max-w-80 rounded-full" />
            </div>
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <section className="mb-12">
        <SectionHeadingSkeleton />
        <WorkoutGridSkeleton />
      </section>
      <section>
        <SectionHeadingSkeleton action />
        <WorkoutGridSkeleton personalized />
      </section>
    </>
  )
}

function HistorySkeleton() {
  return (
    <>
      <header className="mb-8">
        <Skeleton className="h-9 w-64 max-w-[78vw] rounded-xl" />
        <Skeleton className="mt-3 h-3.5 w-72 max-w-[78vw] rounded-full" />
        <div className={layout.historyStatsGrid}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={`${cardClass} p-6`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <Skeleton className={`h-3.5 rounded-full ${index === 1 ? 'w-28' : 'w-24'}`} />
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              </div>
              <Skeleton className={`h-7 rounded-lg ${index === 3 ? 'w-12' : 'w-7'}`} />
            </div>
          ))}
        </div>
      </header>
      <div className="flex min-h-[266px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 app:border-app-line bg-white app:bg-app-surface py-16 text-center dark:border-slate-700/70 dark:bg-slate-900/85">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="mt-4 h-5 w-56 rounded-lg" />
        <Skeleton className="mt-3 h-3.5 w-80 max-w-[78vw] rounded-full" />
      </div>
    </>
  )
}

function TrainingWeekSelectorSkeleton() {
  return (
    <div className="border-b border-slate-200/80 app:border-app-line/80 pb-10 dark:border-white/[0.07] sm:pb-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-5 sm:flex-nowrap">
        <div>
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="mt-3 h-5 w-40 rounded-lg" />
        </div>
        <div className="ml-auto flex shrink-0 gap-2 sm:ml-0">
          <Skeleton className="h-11 w-11 rounded-full" />
          <Skeleton className="h-11 w-11 rounded-full" />
        </div>
      </div>

      <div className="min-w-0 w-full overflow-visible">
        <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className={`flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 sm:min-h-[5.25rem] ${
                index === 3 ? 'bg-primary/[0.06] app:bg-app-action/[0.06] dark:bg-white/[0.04]' : ''
              }`}
            >
              <Skeleton className="h-2.5 w-6 rounded-full" />
              <Skeleton className="mt-2 h-5 w-5 rounded-md" />
              <Skeleton className="mt-2 h-1.5 w-1.5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScheduledWorkoutDeckSkeleton() {
  return (
    <div className="relative pt-8 sm:pt-10">
      <div className="absolute inset-x-5 top-3 h-[18rem] rounded-[1.75rem] border border-primary/10 app:border-app-accent/10 bg-primary/10 app:bg-app-action/10 dark:border-white/[0.05] dark:bg-[#101010]" />
      <div className="absolute inset-x-2 top-6 h-[18rem] rounded-[1.75rem] border border-primary/10 app:border-app-accent/10 bg-primary/15 app:bg-app-action/15 dark:border-white/[0.06] dark:bg-[#111]" />

      <div className="relative z-10 flex min-h-[21.5rem] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 app:border-app-line/80 bg-white app:bg-app-surface shadow-[0_18px_50px_rgba(15,23,42,0.07)] dark:border-white/[0.06] dark:bg-[#080808] dark:shadow-[0_24px_60px_rgba(0,0,0,0.36)] sm:min-h-[23rem]">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-100 app:border-app-line px-5 py-3 dark:border-white/[0.06] sm:px-6">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-11 w-11 rounded-full" />
        </div>
        <div className="flex flex-1 flex-col px-5 py-6 sm:px-7 sm:py-8">
          <Skeleton className="h-1 w-10 rounded-full" />
          <Skeleton className="mt-5 h-10 w-4/5 rounded-xl sm:h-12 sm:w-3/5" />
          <Skeleton className="mt-3 h-10 w-3/5 rounded-xl sm:h-12 sm:w-2/5" />
          <Skeleton className="mt-5 h-3.5 w-full rounded-full" />
          <Skeleton className="mt-2 h-3.5 w-4/5 rounded-full" />
          <Skeleton className="mt-auto h-3 w-40 rounded-full" />
        </div>
        <div className="border-t border-slate-100 app:border-app-line bg-slate-50/70 app:bg-app-muted/70 p-4 dark:border-white/[0.06] dark:bg-[#050505] sm:p-5">
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

function CatalogWorkoutCardSkeleton() {
  return (
    <div className="flex min-h-[17rem] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 app:border-app-line/80 bg-white app:bg-app-surface dark:border-white/[0.06] dark:bg-[#080808]">
      <div className="flex min-h-14 items-center border-b border-slate-100 app:border-app-line px-5 py-3 dark:border-white/[0.06] sm:px-6">
        <Skeleton className="h-3 w-28 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col px-5 py-6 sm:px-7">
        <Skeleton className="h-1 w-10 rounded-full" />
        <Skeleton className="mt-5 h-7 w-4/5 rounded-lg" />
        <Skeleton className="mt-3 h-7 w-3/5 rounded-lg" />
        <Skeleton className="mt-4 h-3.5 w-full rounded-full" />
        <Skeleton className="mt-2 h-3.5 w-4/5 rounded-full" />
        <Skeleton className="mt-auto h-3 w-36 rounded-full" />
      </div>
      <div className="border-t border-slate-100 app:border-app-line bg-slate-50/70 app:bg-app-muted/70 p-4 dark:border-white/[0.06] dark:bg-[#050505] sm:p-5">
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function TrainingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl pb-10 sm:pb-16">
      <header className="mb-9 max-w-2xl sm:mb-12">
        <Skeleton className="h-3 w-36 rounded-full" />
        <Skeleton className="mt-3 h-10 w-40 rounded-xl sm:h-[4.4rem] sm:w-64" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl rounded-full" />
        <Skeleton className="mt-2 h-4 w-4/5 max-w-lg rounded-full sm:hidden" />
      </header>

      <section className="mx-auto max-w-3xl">
        <TrainingWeekSelectorSkeleton />

        <div className="mt-8 sm:mt-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="mt-3 h-7 w-52 rounded-lg sm:h-8 sm:w-64" />
            </div>
            <Skeleton className="h-3 w-14 rounded-full" />
          </div>
          <ScheduledWorkoutDeckSkeleton />
        </div>
      </section>

      <section className="mt-16 sm:mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="mt-3 h-7 w-56 rounded-lg sm:h-8 sm:w-72" />
            <Skeleton className="mt-3 h-3.5 w-64 max-w-[70vw] rounded-full" />
          </div>
          <Skeleton className="hidden h-11 w-28 rounded-xl sm:block" />
        </div>

        <div className="training-rail -mx-4 flex gap-4 overflow-hidden px-4 pb-6 sm:-mx-6 sm:gap-5 sm:px-6 lg:mx-0 lg:px-0">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="min-w-[min(84vw,22rem)] sm:min-w-[22rem] lg:min-w-[23rem]">
              <CatalogWorkoutCardSkeleton />
            </div>
          ))}
        </div>

        <Skeleton className="mt-1 h-11 w-40 rounded-xl sm:hidden" />
      </section>
    </div>
  )
}

function FormFieldSkeleton({ tall = false }) {
  return (
    <div>
      <Skeleton className="h-3 w-32 rounded-full" />
      <Skeleton className={`mt-3 w-full rounded-3xl ${tall ? 'h-28' : 'h-14'}`} />
    </div>
  )
}

function WorkoutViewSectionSkeleton({ rows = 5 }) {
  return (
    <div className="rounded-3xl border border-slate-200 app:border-app-line bg-white app:bg-app-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <div className="mt-2 flex h-7 items-center">
            <Skeleton className="h-6 w-48 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function WorkoutEditorSectionSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-200 app:border-app-line bg-white app:bg-app-surface p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-3 w-64 max-w-[70vw] rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20 rounded-2xl" />
          <Skeleton className="h-10 w-20 rounded-2xl" />
        </div>
      </div>
      <Skeleton className="mb-6 h-12 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-[72px] w-full rounded-2xl" />
        <Skeleton className="h-[72px] w-full rounded-2xl" />
      </div>
    </div>
  )
}

function WorkoutDetailSkeleton({ editing = false, isNew = false }) {
  const actions = editing ? (isNew ? 1 : 3) : 1

  return (
    <>
      <PageHeaderSkeleton eyebrow actions={actions} titleClassName="w-64" />
      <section className={`mb-10 grid gap-6 ${editing ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]' : 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]'}`}>
        <div className="min-w-0 rounded-[2rem] border border-slate-200 app:border-app-line bg-white app:bg-app-surface p-8 shadow-sm">
          {editing ? (
            <div className="space-y-6">
              <FormFieldSkeleton />
              <FormFieldSkeleton tall />
              <Skeleton className="h-12 w-36 rounded-2xl" />
            </div>
          ) : (
            <div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
              <div className="mt-3 flex h-8 items-center">
                <Skeleton className="h-7 w-52 rounded-lg" />
              </div>
              <div className="mt-2 flex h-6 items-center">
                <Skeleton className="h-3.5 w-3/4 rounded-full" />
              </div>
            </div>
          )}
        </div>
        <div className="min-w-0 rounded-[2rem] border border-slate-200 app:border-app-line bg-white app:bg-app-surface p-8 shadow-sm">
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <div className="mt-4 flex h-9 items-center">
            <Skeleton className="h-8 w-32 rounded-xl" />
          </div>
          {editing && <Skeleton className="mt-6 h-12 w-52 rounded-3xl" />}
        </div>
      </section>
      {!isNew && (
        <section className="space-y-6">
          {editing ? <WorkoutEditorSectionSkeleton /> : <WorkoutViewSectionSkeleton rows={5} />}
          {editing ? <WorkoutEditorSectionSkeleton /> : <WorkoutViewSectionSkeleton rows={4} />}
        </section>
      )}
    </>
  )
}

function PlayerSkeleton() {
  return (
    <>
      <div className="mb-8 grid gap-3 md:flex md:items-start md:justify-between">
        <div className="grid gap-3">
          <Skeleton className="h-3 w-36 rounded-full" />
          <Skeleton className="h-7 w-56 rounded-lg" />
          <Skeleton className="h-3.5 w-64 max-w-[72vw] rounded-full" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="space-y-5 lg:col-span-2">
          <div className="space-y-4 rounded-2xl border border-slate-200 app:border-app-line bg-white app:bg-app-surface p-5 dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-3 w-56 max-w-[55%] rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-100 app:border-app-line bg-white app:bg-app-surface dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <Skeleton className="h-2.5 w-24 rounded-full" />
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-6 w-64 max-w-[72%] rounded-lg" />
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                </div>
                <Skeleton className="h-3 w-36 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-[68px] w-full rounded-xl" />
                <Skeleton className="h-[68px] w-full rounded-xl" />
                <Skeleton className="h-[68px] w-full rounded-xl" />
              </div>
              <Skeleton className="h-3.5 w-4/5 rounded-full" />
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="h-[50px] w-full rounded-xl" />
            </div>
          </div>
        </div>
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-primary app:bg-app-action p-5 text-center text-white shadow-lg shadow-blue-300/30 dark:border dark:border-slate-700/70 dark:bg-slate-900 dark:shadow-none sm:p-6">
            <Skeleton className="mx-auto h-3 w-24 rounded-full" inverse />
            <Skeleton className="mx-auto mt-3 h-14 w-40 rounded-xl" inverse />
            <Skeleton className="mx-auto mt-3 h-3 w-28 rounded-full" inverse />
          </div>
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="rounded-2xl border border-gray-100 app:border-app-line bg-white app:bg-app-surface p-5 shadow-sm shadow-slate-200/40 dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-none">
            <Skeleton className="h-3 w-28 rounded-full" />
            <Skeleton className="mt-3 h-[74px] w-full rounded-xl" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

function LoadingContent({ variant }) {
  if (variant === 'workouts') return <WorkoutsSkeleton />
  if (variant === 'history') return <HistorySkeleton />
  if (variant === 'training') return <TrainingSkeleton />
  if (variant === 'editor') return <WorkoutDetailSkeleton editing />
  if (variant === 'editor-new') return <WorkoutDetailSkeleton editing isNew />
  if (variant === 'details') return <WorkoutDetailSkeleton />
  if (variant === 'player') return <PlayerSkeleton />
  return <DashboardSkeleton />
}

export default function LoadingState({ message = 'Carregando...', variant = 'dashboard' }) {
  return (
    <section className="w-full" role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
      <span className="sr-only">{message}</span>
      <div aria-hidden="true">
        <LoadingContent variant={variant} />
      </div>
    </section>
  )
}
