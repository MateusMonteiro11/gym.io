import { ui } from '../../styles/theme'

export function Label({ children, htmlFor, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`${ui.label} ${className}`}>
      {children}
    </label>
  )
}

export default function Input({ className = '', ...props }) {
  return <input className={`${ui.input} ${className}`} {...props} />
}
