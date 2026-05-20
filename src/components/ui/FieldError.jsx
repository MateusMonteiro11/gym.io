import { motion, AnimatePresence } from 'framer-motion'

export default function FieldError({ message, variant = 'error' }) {

  // Possiveis variantes de estilo para diferentes tipos de mensagens (erro, aviso, info/sucesso)

  const variants = {
    error: {
      icon: '⚠',
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      badge: 'bg-red-100 text-red-600',
    },
    warning: { // Ainda não utilizado, mas pode ser útil para avisos que não bloqueiam a ação (ex.: "sua sessão vai expirar em breve")
      icon: '⚡',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-600',
    },
    info: {
      icon: 'ℹ', // Também pode ser usado para mensagens de sucesso (ex.: "Treino salvo com sucesso!")
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-600',
    },
  }

  const config = variants[variant]

  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`mt-2 flex items-start gap-2.5 rounded-lg ${config.bgColor} border ${config.borderColor} p-3`}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
            className={`flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full ${config.badge} text-xs font-bold`}
          >
            {config.icon}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className={`text-sm font-medium ${config.color}`}
          >
            {message}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
