import { ui } from '../../styles/theme'

const variants = {
  primary: ui.btnPrimary,
  secondary: ui.btnSecondary,
  ghost: ui.btnGhost,
  danger: ui.btnDanger,
}

export default function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
