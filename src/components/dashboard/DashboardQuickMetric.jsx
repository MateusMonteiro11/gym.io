import Card from '../ui/Card'

export default function DashboardQuickMetric({ eyebrow, value, label, detail, icon }) {
  return (
    <Card hover={false} className="dashboard-surface min-h-[178px] border-app-line bg-app-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-secondary">{eyebrow}</p>
          <div className="mt-5 flex items-end gap-2">
            <strong className="text-4xl font-semibold leading-none tracking-[-0.05em] text-app-ink">{value}</strong>
            <span className="pb-0.5 text-sm font-medium text-app-ink">{label}</span>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-app-secondary">{detail}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-selection text-app-accent" aria-hidden="true">
          <i className={`fa-solid ${icon}`} />
        </div>
      </div>
    </Card>
  )
}
