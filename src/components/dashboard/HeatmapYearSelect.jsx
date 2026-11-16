import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export default function HeatmapYearSelect({ years, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(value)
  const id = useId()
  const root = useRef(null)
  const trigger = useRef(null)
  const options = useRef(new Map())

  useEffect(() => {
    if (!open) return
    options.current.get(focused)?.focus()
  }, [open, focused])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  function choose(year) {
    onChange(year)
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }

  function handleKeyDown(event) {
    const index = years.indexOf(focused)
    if (event.key === 'ArrowDown') setFocused(years[Math.min(years.length - 1, index + 1)])
    else if (event.key === 'ArrowUp') setFocused(years[Math.max(0, index - 1)])
    else if (event.key === 'Home') setFocused(years[0])
    else if (event.key === 'End') setFocused(years[years.length - 1])
    else if (event.key === 'Enter' || event.key === ' ') choose(focused)
    else if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    else if (event.key === 'Tab') { setOpen(false); return }
    else return
    event.preventDefault()
  }

  return (
    <div ref={root} className="relative shrink-0" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <button
        ref={trigger}
        type="button"
        aria-label={`Selecionar ano, ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => { setFocused(value); setOpen((previous) => !previous) }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setFocused(value)
            setOpen(true)
          }
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-app-line bg-app-muted px-3 text-sm font-semibold tabular-nums text-app-ink hover:bg-app-selection focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
      >
        {value}<ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul id={id} role="listbox" aria-label="Ano do calendário" onKeyDown={handleKeyDown} className="absolute right-0 top-full z-20 mt-2 max-h-52 w-40 overflow-y-auto overscroll-contain rounded-xl border border-app-line bg-app-surface p-1 shadow-lg">
          {years.map((year) => (
            <li
              key={year}
              ref={(node) => { if (node) options.current.set(year, node); else options.current.delete(year) }}
              role="option"
              aria-selected={year === value}
              tabIndex={focused === year ? 0 : -1}
              onFocus={() => setFocused(year)}
              onClick={() => choose(year)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-sm tabular-nums outline-none hover:bg-app-muted focus:bg-app-selection ${year === value ? 'font-semibold text-app-accent' : 'text-app-ink'}`}
            >
              <span>{year}</span>
              {year === value && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
