import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ui } from '../../styles/theme'

export default function Modal({
  open,
  onClose,
  children,
  size = 'md',
  className = '',
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-5xl',
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`${ui.overlay} bg-slate-950/45`}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`${ui.modalPanel} ${sizes[size] || sizes.md} ${className}`}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
