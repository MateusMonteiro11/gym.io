import { ui } from '../../styles/theme'

export default function Card({ as: Component = 'div', className = '', children, hover = true, ...props }) {
  return (
    <Component
      className={`${ui.card} ${hover ? ui.cardHover : ''} ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}
