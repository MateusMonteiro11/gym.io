import { motion, useReducedMotion } from 'framer-motion'

const shimmerTransition = {
  duration: 1.35,
  ease: 'linear',
  repeat: Infinity,
  repeatDelay: 0.08,
}

export function Skeleton({ className = '', inverse = false }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.span
      aria-hidden="true"
      className={`skeleton-shimmer block ${inverse ? 'skeleton-shimmer-inverse' : ''} ${className}`}
    >
      {!reduceMotion && (
        <motion.span
          className="skeleton-shimmer-wave pointer-events-none absolute inset-0"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={shimmerTransition}
        />
      )}
    </motion.span>
  )
}

export function SkeletonList({ items = 3, compact = false, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: items }, (_, index) => (
        <div
          key={index}
          className={`rounded-2xl border border-slate-200/80 bg-white/70 dark:border-white/[0.06] dark:bg-[#0b0b0b] ${
            compact ? 'p-3' : 'p-4'
          }`}
        >
          <div className="flex items-center gap-3">
            <Skeleton className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} shrink-0 rounded-xl`} />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className={`h-3.5 rounded-full ${index % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
              <Skeleton className="h-2.5 w-1/3 rounded-full" />
            </div>
            <Skeleton className="h-7 w-14 shrink-0 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
