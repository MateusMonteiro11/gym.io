import { motion, AnimatePresence } from 'framer-motion'

export default function FieldError({ message }) {

  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mt-2 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 shadow-sm"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600"
          >
            ⚠
          </motion.div>

          <motion.p
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="text-sm font-medium text-red-500"
          >
            {message}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
