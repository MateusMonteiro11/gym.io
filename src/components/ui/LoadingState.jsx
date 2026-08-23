import { Skeleton } from './Skeleton'
import { layout } from '../../styles/layout'
import { ui } from '../../styles/theme'

const cardClass = ui.card

function PageHeaderSkeleton({
  eyebrow = false,
  actions = 0,
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
    </div>
  )
}

function StatCardsSkeleton() {
  return (
    <div className={layout.dashboardStatsGrid}>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={`${cardClass} p-6 xl:min-h-[166px]`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Skeleton className="mb-3 h-3.5 w-28 rounded-full" />
              <Skeleton className={`h-10 rounded-xl ${index === 3 ? 'w-24' : 'w-16'}`} />
              <Skeleton className="mt-4 h-2.5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

function DashboardPanelSkeleton({ activity = false }) {
  return (
    <div className={`${cardClass} flex h-80 flex-col p-6`}>
      <Skeleton className={`h-5 rounded-lg ${activity ? 'w-40' : 'w-36'}`} />
      <Skeleton className="mb-6 mt-3 h-3 w-52 rounded-full" />
      <div className="flex flex-1 items-start justify-center py-8">
        <Skeleton className={`h-3.5 rounded-full ${activity ? 'w-52' : 'w-48'}`} />
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <PageHeaderSkeleton titleClassName="w-32" />
      <StatCardsSkeleton />
      <div className={layout.dashboardPanelsGrid}>
        <DashboardPanelSkeleton />
        <DashboardPanelSkeleton activity />
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

function WorkoutCardSkeleton() {
  return (
    <div className={`${cardClass} overflow-hidden sm:min-h-[289px]`}>
      <Skeleton className="h-2 w-full rounded-none" />
      <div className="flex h-11 items-center justify-end gap-2 border-b border-slate-100 bg-slate-50 px-3 dark:border-white/[0.06] dark:bg-[#060606]">
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-2/3 rounded-lg" />
        <Skeleton className="mt-3 h-3 w-full rounded-full" />
        <Skeleton className="mt-2 h-3 w-3/4 rounded-full" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function WorkoutGridSkeleton({ count = 4 }) {
  return (
    <div className={layout.workoutsGrid}>
      {Array.from({ length: count }, (_, index) => (
        <WorkoutCardSkeleton key={index} />
      ))}
    </div>
  )
}

function WorkoutsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton titleClassName="w-36" />
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary-muted/60 p-6 dark:border-white/[0.06] dark:bg-[#090909] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div>
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-48 rounded-lg" />
            </div>
            <div className="mt-1 flex h-5 items-center">
              <Skeleton className="h-3 w-80 max-w-[55vw] rounded-full" />
            </div>
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <section className="mb-12">
        <SectionHeadingSkeleton />
        <WorkoutGridSkeleton count={5} />
      </section>
      <section>
        <SectionHeadingSkeleton action />
        <EmptyWorkoutLibrarySkeleton />
      </section>
    </>
  )
}

function EmptyWorkoutLibrarySkeleton() {
  return (
    <div className={`${cardClass} flex min-h-[262px] flex-col items-center justify-center p-6 text-center`}>
      <Skeleton className="h-16 w-16 rounded-2xl" />
      <Skeleton className="mt-4 h-4 w-64 max-w-[72vw] rounded-lg" />
      <Skeleton className="mt-3 h-3 w-80 max-w-[78vw] rounded-full" />
      <Skeleton className="mt-6 h-10 w-52 rounded-xl" />
    </div>
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
      <div className="flex min-h-[266px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center dark:border-slate-700/70 dark:bg-slate-900/85">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="mt-4 h-5 w-56 rounded-lg" />
        <Skeleton className="mt-3 h-3.5 w-80 max-w-[78vw] rounded-full" />
      </div>
    </>
  )
}

function TrainingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">
      <div className="flex h-[45px] items-center justify-end border-b border-slate-100 bg-slate-50 px-4 dark:border-slate-700/70 dark:bg-slate-950/70">
        <Skeleton className="h-7 w-[73px] rounded-lg" />
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-4/5 rounded-lg" />
            </div>
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-2/3 rounded-lg" />
            </div>
            <div className="mt-1 flex h-5 items-center">
              <Skeleton className="h-3.5 w-full rounded-full" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-4/5 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-[66px] w-full rounded-xl" />
          <Skeleton className="h-[66px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function TrainingGridSkeleton({ count = 5 }) {
  return (
    <div className={layout.trainingGrid}>
      {Array.from({ length: count }, (_, index) => <TrainingCardSkeleton key={index} />)}
    </div>
  )
}

function EmptyScheduledSkeleton() {
  return (
    <div className={`${cardClass} flex min-h-[219px] flex-col items-center justify-center p-10 text-center`}>
      <Skeleton className="h-16 w-16 rounded-2xl" />
      <Skeleton className="mt-4 h-5 w-72 max-w-[74vw] rounded-lg" />
      <Skeleton className="mt-3 h-3.5 w-64 max-w-[70vw] rounded-full" />
    </div>
  )
}

function TrainingSkeleton() {
  return (
    <>
      <div className="mb-10">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <div className="mt-1 flex h-6 items-center">
          <Skeleton className="h-4 w-72 max-w-[78vw] rounded-full" />
        </div>
      </div>
      <section className="mb-10">
        <div className="mb-5">
          <div className="flex h-7 items-center">
            <Skeleton className="h-6 w-52 rounded-lg" />
          </div>
          <div className="mt-1 flex h-5 items-center">
            <Skeleton className="h-3 w-64 rounded-full" />
          </div>
        </div>
        <TrainingGridSkeleton count={5} />
      </section>
      <section>
        <div className="mb-5">
          <div className="flex h-7 items-center">
            <Skeleton className="h-6 w-48 rounded-lg" />
          </div>
          <div className="mt-1 flex h-5 items-center">
            <Skeleton className="h-3 w-64 rounded-full" />
          </div>
        </div>
        <EmptyScheduledSkeleton />
      </section>
    </>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
        <div className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
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
        <div className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
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
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-3 w-56 max-w-[55%] rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">
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
          <div className="overflow-hidden rounded-2xl bg-primary p-5 text-center text-white shadow-lg shadow-blue-300/30 dark:border dark:border-slate-700/70 dark:bg-slate-900 dark:shadow-none sm:p-6">
            <Skeleton className="mx-auto h-3 w-24 rounded-full" inverse />
            <Skeleton className="mx-auto mt-3 h-14 w-40 rounded-xl" inverse />
            <Skeleton className="mx-auto mt-3 h-3 w-28 rounded-full" inverse />
          </div>
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-slate-200/40 dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-none">
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
    <section className="w-full" role="status" aria-live="polite" aria-label={message}>
      <span className="sr-only">{message}</span>
      <LoadingContent variant={variant} />
    </section>
  )
}
