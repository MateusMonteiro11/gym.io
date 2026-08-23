import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import NotificationCenter from '../components/ui/NotificationCenter'

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

const NOTIFICATION_DURATIONS = {
  success: 4500,
  info: 5500,
  warning: 7000,
  error: 9000,
}

const NOTIFICATION_TYPES = new Set(Object.keys(NOTIFICATION_DURATIONS))

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
  const [notifications, setNotifications] = useState([])
  const confirmResolver = useRef(null)
  const notificationSequence = useRef(0)
  const notificationTimers = useRef(new Map())

  useEffect(
    () => () => {
      notificationTimers.current.forEach((timer) => window.clearTimeout(timer))
      notificationTimers.current.clear()
    },
    []
  )

  const closeFeedback = useCallback(() => setFeedback(null), [])

  const alert = useCallback(({ title = 'Atenção', message, type = 'info', onClose }) => {
    setFeedback({ title, message, type, onClose })
  }, [])

  const dismissNotification = useCallback((id) => {
    const timer = notificationTimers.current.get(id)
    if (timer) window.clearTimeout(timer)
    notificationTimers.current.delete(id)
    setNotifications((current) => current.filter((notification) => notification.id !== id))
  }, [])

  const notify = useCallback(({ title, message, type = 'success', duration }) => {
    if (!title && !message) return null

    const normalizedType = NOTIFICATION_TYPES.has(type) ? type : 'info'
    const defaultDuration = NOTIFICATION_DURATIONS[normalizedType]
    const requestedDuration = Number(duration)
    const notificationDuration = Number.isFinite(requestedDuration)
      ? Math.max(0, requestedDuration)
      : defaultDuration
    notificationSequence.current += 1
    const id = `gym-notification-${notificationSequence.current}`

    setNotifications((current) => [...current, { id, title, message, type: normalizedType }])

    if (notificationDuration > 0) {
      const timer = window.setTimeout(() => {
        notificationTimers.current.delete(id)
        setNotifications((current) => current.filter((notification) => notification.id !== id))
      }, notificationDuration)
      notificationTimers.current.set(id, timer)
    }

    return id
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

  const contextValue = useMemo(() => ({ alert, notify, confirm }), [alert, confirm, notify])

  return (
    <UiContext.Provider value={contextValue}>
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

      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
    </UiContext.Provider>
  )
}

export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used within UiProvider')
  return ctx
}
