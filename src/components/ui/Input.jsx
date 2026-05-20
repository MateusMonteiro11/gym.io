import { motion } from 'framer-motion'
import { ui } from '../../styles/theme'
import FieldError from './FieldError'

export function Label({ children, htmlFor, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`${ui.label} ${className}`}>
      {children}
    </label>
  )
}

export default function Input({
  className = '',
  error = '',
  errorVariant = 'error',
  containerClassName = '',
  ...props
}) {
  return (
    <div className={containerClassName}>
      <motion.input
        className={`${ui.input} ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''} ${className}`}
        animate={error ? { x: [-2, 2, -2, 2, 0] } : {}}
        transition={{ duration: 0.3 }}
        {...props}
      />
      <FieldError message={error} variant={errorVariant} />
    </div>
  )
}
