import { ui } from '../../styles/theme'

export default function Card({ className = '', children, hover = true, ...props }) {
  return (
    <div
      className={`${ui.card} ${hover ? ui.cardHover : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
