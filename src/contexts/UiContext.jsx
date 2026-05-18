import { createContext, useCallback, useContext, useState } from 'react'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'

const UiContext = createContext(null)

const ICONS = {
  success: 'fa-circle-check text-success',
  error: 'fa-circle-xmark text-danger',
  warning: 'fa-triangle-exclamation text-amber-600',
  info: 'fa-circle-info text-primary',
}

export function UiProvider({ children }) {
  const [feedback, setFeedback] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmation, setConfirmation] = useState(null)

  const closeFeedback = useCallback(() => setFeedback(null), [])

  const alert = useCallback(({ title = 'Atenção', message, type = 'info', onClose }) => {
    setFeedback({
      title,
      message,
      type,
      onClose,
    })
  }, [])

  const notify = useCallback(
    ({ title, message, type = 'success', duration = 4000 }) => {
      setToast({ title, message, type })
      if (duration > 0) {
        setTimeout(() => setToast(null), duration)
      }
    },
    []
  )

  const confirm = useCallback(
    ({ title = 'Confirmação', message, confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'warning' }) => {
      return new Promise((resolve) => {
        setConfirmation({
          title,
          message,
          confirmText,
          cancelText,
          type,
          onConfirm: () => {
            setConfirmation(null)
            resolve(true)
          },
          onCancel: () => {
            setConfirmation(null)
            resolve(false)
          },
        })
      })
    },
    []
  )

  const handleFeedbackClose = () => {
    feedback?.onClose?.()
    closeFeedback()
  }

  const handleConfirmationCancel = () => {
    confirmation?.onCancel?.()
  }

  const handleConfirmationConfirm = () => {
    confirmation?.onConfirm?.()
  }

  return (
    <UiContext.Provider value={{ alert, notify, confirm }}>
      {children}

      <Modal open={!!feedback} onClose={handleFeedbackClose} size="sm">
        <div className="p-6 text-center">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100`}
          >
            <i className={`fa-solid text-2xl ${ICONS[feedback?.type] || ICONS.info}`} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{feedback?.title}</h3>
          {feedback?.message && (
            <p className="mt-2 text-sm text-slate-600">{feedback.message}</p>
          )}
          <Button className="mt-6 w-full" onClick={handleFeedbackClose}>
            OK
          </Button>
        </div>
      </Modal>

      <Modal open={!!confirmation} onClose={handleConfirmationCancel} size="sm">
        <div className="p-6 text-center">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100`}
          >
            <i className={`fa-solid text-2xl ${ICONS[confirmation?.type] || ICONS.warning}`} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{confirmation?.title}</h3>
          {confirmation?.message && (
            <p className="mt-2 text-sm text-slate-600">{confirmation.message}</p>
          )}
          <div className="mt-6 flex gap-3 justify-center sm:justify-end">
            <Button variant="secondary" onClick={handleConfirmationCancel}>
              {confirmation?.cancelText}
            </Button>
            <Button variant="danger" onClick={handleConfirmationConfirm}>
              {confirmation?.confirmText}
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
            <i className={`fa-solid mt-0.5 ${ICONS[toast.type] || ICONS.success}`} />
            <div className="flex-1 min-w-0">
              {toast.title && (
                <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              )}
              {toast.message && (
                <p className="text-sm text-slate-600">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Fechar"
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
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
