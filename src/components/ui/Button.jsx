import { motion, useReducedMotion } from 'framer-motion'
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
  const reducedMotion = useReducedMotion()
  return (
    <motion.button
      type={type}
      className={`${variants[variant] || variants.primary} shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-sm ${className}`}
      whileTap={{ scale: props.disabled || reducedMotion ? 1 : 0.98 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
