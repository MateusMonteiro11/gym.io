import { useEffect } from 'react'

export function focusFirstError(errors) {
  const id = Object.keys(errors)[0]
  if (id) requestAnimationFrame(() => document.getElementById(id)?.focus())
}

export function useAuthDialogFocus(open) {
  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement
    const selector = 'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'
    let dialog
    const frame = requestAnimationFrame(() => {
      dialog = document.querySelector('[role="dialog"]')
      const input = dialog?.querySelector('input:not(:disabled)')
      const initialControl = input || dialog?.querySelector(selector)
      initialControl?.focus()
    })
    function trapFocus(event) {
      if (event.key !== 'Tab' || !dialog) return
      const controls = Array.from(dialog.querySelectorAll(selector)).filter((node) => node.getClientRects().length)
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', trapFocus)
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [open])
}
