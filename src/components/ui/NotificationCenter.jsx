import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const MOTION_EASE = [0.22, 1, 0.36, 1]

function NotificationItem({ notification, onDismiss, reduceMotion }) {
  const isUrgent = notification.type === 'error'

  return (
    <motion.li
      layout="position"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.24, ease: MOTION_EASE }}
    >
      <div
        role={isUrgent ? 'alert' : 'status'}
        aria-live={isUrgent ? 'assertive' : 'polite'}
        aria-atomic="true"
        className="pointer-events-none flex min-h-[4.875rem] items-center gap-4 rounded-xl border border-slate-200 app:border-app-line bg-white app:bg-app-surface px-[1.125rem] py-3.5 shadow-card dark:border-white/[0.08] dark:bg-[#0b0d0c] dark:shadow-[0_14px_36px_-22px_rgba(0,0,0,0.9)]"
      >
        <div className="min-w-0 flex-1">
          {notification.title && (
            <p className="text-[15px] font-semibold leading-5 text-slate-900 app:text-app-ink dark:text-slate-100">
              {notification.title}
            </p>
          )}
          {notification.message && (
            <p className="mt-1 break-words text-[13px] leading-[1.125rem] text-slate-500 app:text-app-secondary dark:text-blue-300/60">
              {notification.message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          aria-label={`Fechar notificação${notification.title ? `: ${notification.title}` : ''}`}
          className="pointer-events-auto -mr-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 app:text-app-secondary transition-colors duration-200 hover:bg-slate-100 app:hover:bg-app-muted hover:text-primary app:hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 app:focus-visible:ring-app-accent dark:text-slate-500 dark:hover:bg-white/[0.05] dark:hover:text-blue-300"
        >
          <i aria-hidden="true" className="fa-solid fa-xmark text-base" />
        </button>
      </div>
    </motion.li>
  )
}

export default function NotificationCenter({ notifications, onDismiss }) {
  const reduceMotion = useReducedMotion()

  return (
    <section
      aria-label="Notificações"
      className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] sm:left-auto sm:right-5 sm:w-[26rem]"
    >
      <motion.ol layout className="flex flex-col gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onDismiss={onDismiss}
              reduceMotion={reduceMotion}
            />
          ))}
        </AnimatePresence>
      </motion.ol>
    </section>
  )
}
