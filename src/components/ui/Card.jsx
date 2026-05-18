import { ui } from '../../styles/theme'

export default function Card({ className = '', children, hover = true, ...props }) {
  return (
    <div
      className={`${ui.card} ${hover ? 'hover:shadow-card-hover' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
