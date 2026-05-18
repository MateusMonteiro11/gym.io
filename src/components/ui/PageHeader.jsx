import { ui } from '../../styles/theme'

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className={ui.pageTitle}>{title}</h1>
        {subtitle && <p className={ui.pageSubtitle}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
