import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import { ui } from '../../styles/theme.js'

export default function Disclosure({
  label,
  openLabel,
  defaultOpen = false,
  className = '',
  buttonClassName = '',
  contentClassName = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const reduceMotion = useReducedMotion()
  const generatedId = useId().replace(/[^a-z0-9_-]/gi, '')
  const buttonId = `disclosure-button-${generatedId}`
  const contentId = `disclosure-content-${generatedId}`
  const duration = reduceMotion ? 0.01 : 0.2

  return (
    <div className={className}>
      <button
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className={`${ui.btnGhost} min-h-11 w-fit text-xs font-semibold ${buttonClassName}`}
      >
        <span>{open ? openLabel : label}</span>
        <motion.span
          className="inline-flex"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ y: reduceMotion ? 0 : -4 }}
              animate={{ y: 0 }}
              exit={{ y: reduceMotion ? 0 : -4 }}
              transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
              className={contentClassName}
            >
              {children}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
