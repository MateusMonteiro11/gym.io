import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'

const UiContext = createContext(null)

const ICONS = {
  success: 'fa-circle-check',
  error: 'fa-circle-xmark',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
  danger: 'fa-trash-can',
}

const ICON_STYLES = {
  success: 'bg-success-muted text-success',
  error: 'bg-danger-muted text-danger',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-primary-muted text-primary',
  danger: 'bg-danger-muted text-danger',
}

function DialogIcon({ type }) {
  return (
    <div
      className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${ICON_STYLES[type] || ICON_STYLES.info}`}
    >
      <i className={`fa-solid text-2xl ${ICONS[type] || ICONS.info}`} />
    </div>
  )
}

export function UiProvider({ children }) {
  const [feedback, setFeedback] = useState(null)
  const [confirmState, setConfirmState] = useState(null)
  const [toast, setToast] = useState(null)
  const confirmResolver = useRef(null)

  const closeFeedback = useCallback(() => setFeedback(null), [])

  const alert = useCallback(({ title = 'Atenção', message, type = 'info', onClose }) => {
    setFeedback({ title, message, type, onClose })
  }, [])

  const notify = useCallback(({ title, message, type = 'success', duration = 4000 }) => {
    setToast({ title, message, type })
    if (duration > 0) {
      setTimeout(() => setToast(null), duration)
    }
  }, [])

  const confirm = useCallback(
    ({
      title = 'Confirmar ação',
      message,
      confirmLabel = 'Confirmar',
      cancelLabel = 'Cancelar',
      variant = 'danger',
    }) =>
      new Promise((resolve) => {
        confirmResolver.current = resolve
        setConfirmState({
          title,
          message,
          confirmLabel,
          cancelLabel,
          variant,
        })
      }),
    []
  )

  const finishConfirm = (result) => {
    setConfirmState(null)
    confirmResolver.current?.(result)
    confirmResolver.current = null
  }

  const handleFeedbackClose = () => {
    feedback?.onClose?.()
    closeFeedback()
  }

  return (
    <UiContext.Provider value={{ alert, notify, confirm }}>
      {children}

      <Modal open={!!feedback} onClose={handleFeedbackClose} size="sm">
        <div className="p-6">
          <DialogIcon type={feedback?.type} />
          <h3 className="text-center text-lg font-semibold text-slate-900">{feedback?.title}</h3>
          {feedback?.message && (
            <p className="mt-2 whitespace-pre-line text-center text-sm leading-relaxed text-slate-600">
              {feedback.message}
            </p>
          )}
          <Button className="mt-6 w-full" onClick={handleFeedbackClose}>
            Entendi
          </Button>
        </div>
      </Modal>

      <Modal open={!!confirmState} onClose={() => finishConfirm(false)} size="sm">
        <div className="p-6">
          <DialogIcon type={confirmState?.variant === 'danger' ? 'danger' : 'warning'} />
          <h3 className="text-center text-lg font-semibold text-slate-900">{confirmState?.title}</h3>
          {confirmState?.message && (
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">{confirmState.message}</p>
          )}
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => finishConfirm(false)}>
              {confirmState?.cancelLabel || 'Cancelar'}
            </Button>
            <Button
              variant={confirmState?.variant === 'danger' ? 'danger' : 'primary'}
              className="flex-1"
              onClick={() => finishConfirm(true)}
            >
              {confirmState?.confirmLabel || 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[60] max-w-sm animate-toast-in"
          role="status"
        >
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_STYLES[toast.type] || ICON_STYLES.success}`}
            >
              <i className={`fa-solid ${ICONS[toast.type] || ICONS.success}`} />
            </span>
            <div className="min-w-0 flex-1">
              {toast.title && <p className="text-sm font-semibold text-slate-900">{toast.title}</p>}
              {toast.message && <p className="text-sm text-slate-600">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Fechar"
              className="cursor-pointer text-slate-400 transition-colors duration-200 hover:text-slate-700"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>
      )}
    </UiContext.Provider>
  )
}

export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used within UiProvider')
  return ctx
}
