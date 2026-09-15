import { ui } from '../../styles/theme'

export default function PageHeader({ title, subtitle, children, stackUntilWide = false }) {
  const responsiveLayout = stackUntilWide
    ? 'xl:flex-row xl:items-end xl:justify-between'
    : 'sm:flex-row sm:items-end sm:justify-between'

  return (
    <div className={`mb-8 flex flex-col gap-4 ${responsiveLayout}`}>
      <div>
        <h1 className={ui.pageTitle}>{title}</h1>
        {subtitle && <p className={ui.pageSubtitle}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
