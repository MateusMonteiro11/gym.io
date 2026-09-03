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
        className={`${ui.input} shadow-sm shadow-slate-900/5 hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/5 focus:bg-white focus:shadow-lg focus:shadow-blue-900/10 ${error ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/10' : ''} ${className}`}
        animate={error ? { x: [-2, 2, -2, 2, 0] } : {}}
        whileFocus={{ y: -1, scale: 1.005 }}
        transition={{ duration: 0.25 }}
        {...inputProps}
      />
      <FieldError id={errorId} message={error} variant={errorVariant} />
    </div>
  )
}
