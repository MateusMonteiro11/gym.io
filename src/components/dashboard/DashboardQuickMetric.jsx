import Card from '../ui/Card'

export default function DashboardQuickMetric({ eyebrow, value, label, detail, icon }) {
  return (
    <Card hover={false} className="dashboard-surface min-h-[178px] border-slate-200 bg-white p-6 dark:border-white/[0.08] dark:bg-[#090909]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{eyebrow}</p>
          <div className="mt-5 flex items-end gap-2">
            <strong className="text-4xl font-semibold leading-none tracking-[-0.05em] text-slate-950 dark:text-white">{value}</strong>
            <span className="pb-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary dark:bg-blue-950/60 dark:text-blue-300" aria-hidden="true">
          <i className={`fa-solid ${icon}`} />
        </div>
      </div>
    </Card>
  )
}
