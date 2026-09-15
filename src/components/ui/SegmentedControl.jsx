import { motion, useReducedMotion } from 'framer-motion'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black'

export default function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
  layoutId,
  className = '',
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      className={`inline-flex max-w-full gap-1 rounded-2xl bg-slate-200/60 p-1 dark:bg-white/[0.05] ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`relative inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200 ${focusRing} ${
              selected
                ? 'text-primary'
                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white'
            }`}
          >
            {selected ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-[#181818]"
                transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
