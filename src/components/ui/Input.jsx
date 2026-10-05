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
  errorId,
  errorVariant = 'card',
  containerClassName = '',
  ...props
}) {
  const inputProps = { ...props }

  if (error) {
    inputProps['aria-invalid'] = true

    if (errorId) {
      const describedBy = inputProps['aria-describedby']
      inputProps['aria-describedby'] = describedBy ? `${describedBy} ${errorId}` : errorId
    }
  }

  return (
    <div className={containerClassName}>
      <motion.input
        className={`${ui.input} focus:bg-white app:focus:bg-app-surface ${error ? 'bg-red-50/40 app:bg-app-danger-muted/40' : ''} ${className}`}
        animate={error ? { x: [-2, 2, -2, 2, 0] } : {}}
        transition={{ duration: 0.25 }}
        {...inputProps}
      />
      <FieldError id={errorId} message={error} variant={errorVariant} />
    </div>
  )
}
