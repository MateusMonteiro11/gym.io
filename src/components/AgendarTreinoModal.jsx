import { useEffect, useRef, useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { useUi } from '../contexts/UiContext'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import Input, { Label } from './ui/Input'
import Button from './ui/Button'
import Card from './ui/Card'
import ActionLoading from './ui/ActionLoading'
import SchedulingNotificationPrompt from './SchedulingNotificationPrompt'
import { validateScheduleDate } from '../utils/dateUtils'
import { reminderOptions, saoPauloDate, validateReminderTime } from '../utils/appointmentReminders'
import { getSchedulingErrorMessage } from '../utils/errorMessages'
import { usePushNotifications } from '../hooks/usePushNotifications'

export default function AgendarTreinoModal({ open, treino, onClose, onAgendar }) {
  const { alert } = useUi()
  const [dataAgendada, setDataAgendada] = useState('')
  const [dataError, setDataError] = useState('')
  const [horarioLocal, setHorarioLocal] = useState('')
  const [lembretes, setLembretes] = useState([])
  const [horarioError, setHorarioError] = useState('')
  const [agendamentoError, setAgendamentoError] = useState('')
  const [agendando, setAgendando] = useState(false)
  const [ativando, setAtivando] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [activationFailed, setActivationFailed] = useState(false)
  const operation = useRef(false)
  const scope = useRef(0)
  const pendingInput = useRef(null)
  const content = useRef(null)
  const restoreFocus = useRef(false)
  const push = usePushNotifications()
  const today = saoPauloDate()
  const busy = agendando || ativando || push.busy
  const promptStatus = push.error === 'push_not_configured' ? 'push_not_configured' : push.status

  useEffect(() => {
    operation.current = false
    pendingInput.current = null
    setShowPrompt(false)
    setActivationFailed(false)
    setAgendando(false)
    setAtivando(false)
    if (!open) {
      restoreFocus.current = false
      setDataAgendada('')
      setDataError('')
      setHorarioLocal('')
      setLembretes([])
      setHorarioError('')
      setAgendamentoError('')
    }
    return () => { scope.current += 1 }
  }, [open, treino?.id_treino])

  useEffect(() => {
    if (showPrompt) restoreFocus.current = true
    else if (restoreFocus.current && open && !busy) {
      content.current?.querySelector('#agendar-treino-submit')?.focus()
      restoreFocus.current = false
    }
  }, [showPrompt, open, busy])

  const closePrompt = () => {
    if (operation.current) return
    setShowPrompt(false)
    setActivationFailed(false)
    pendingInput.current = null
  }

  const closeModal = () => {
    if (operation.current || busy) return
    if (showPrompt) closePrompt()
    else onClose?.()
  }

  const schedule = async (input) => {
    if (!open || !input || operation.current) return
    const current = scope.current
    operation.current = true
    setAgendando(true)
    setAgendamentoError('')
    setShowPrompt(false)
    try {
      await onAgendar(input)
    } catch (error) {
      if (current === scope.current) setAgendamentoError(getSchedulingErrorMessage(error))
    } finally {
      if (current === scope.current) {
        operation.current = false
        setAgendando(false)
      }
    }
  }

  const handleAgendar = () => {
    if (operation.current || busy) return
    const validation = validateScheduleDate(dataAgendada, today)
    if (!validation.isValid) {
      setDataError(validation.message)
      alert({ title: 'Revise a data', message: validation.message, type: 'warning' })
      return
    }
    const timeError = validateReminderTime(horarioLocal, lembretes)
    setHorarioError(timeError)
    if (timeError) return
    const input = { dataAgendada, horarioLocal: horarioLocal || null, lembretes: [...lembretes] }
    if (push.status === 'subscribed') return schedule(input)
    pendingInput.current = input
    setActivationFailed(false)
    setShowPrompt(true)
  }

  const enableNotifications = async () => {
    if (operation.current || busy) return
    const current = scope.current
    const input = pendingInput.current
    operation.current = true
    setAtivando(true)
    let result = null
    try {
      result = await push.enable()
    } catch 
      {
    } finally {
      if (current === scope.current) {
        operation.current = false
        setAtivando(false)
      }
    }
    if (current !== scope.current) return
    if (result?.status === 'subscribed') return schedule(input)
    setActivationFailed(true)
  }

  const trapPromptFocus = (event) => {
    if (!showPrompt || event.key !== 'Tab') return
    const buttons = [...content.current.querySelectorAll('button:not(:disabled)')]
    const first = buttons[0], last = buttons.at(-1)
    if (!first) { event.preventDefault(); return }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus()
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : closeModal}
      ariaLabel={showPrompt ? 'Notificações do agendamento' : 'Agendar treino'}
      size="md"
      className="min-w-0 !max-h-[calc(100dvh-2rem)]"
    >
      <div ref={content} onKeyDown={trapPromptFocus}>
        {showPrompt ? (
          <SchedulingNotificationPrompt
            status={promptStatus}
            busy={busy}
            enabling={ativando}
            failed={activationFailed}
            onEnable={enableNotifications}
            onContinue={() => schedule(pendingInput.current)}
            onClose={closePrompt}
          />
        ) : (
          <>
            <ModalHeader title="Agendar treino" onClose={busy ? undefined : closeModal} />
            <div className="min-w-0 max-w-full space-y-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <Card hover={false} className="min-w-0 max-w-full border-app-line bg-app-muted px-3 py-2.5 !shadow-none">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <h3 className="min-w-0 break-words font-semibold text-app-ink">{treino?.nome}</h3>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-selection text-app-accent">
                    <Dumbbell size={18} aria-hidden="true" />
                  </span>
                </div>
              </Card>
              <div className="w-full min-w-0 max-w-full">
                <Label htmlFor="data-agendamento">Data agendada</Label>
                <Input
                  id="data-agendamento"
                  type="date"
                  lang="pt-BR"
                  value={dataAgendada}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setDataAgendada(nextValue)
                    setDataError(nextValue ? validateScheduleDate(nextValue, today).message : '')
                  }}
                  min={today}
                  disabled={busy}
                  error={dataError}
                  errorId="data-agendamento-error"
                  aria-invalid={Boolean(dataError)}
                  containerClassName="w-full min-w-0 max-w-full"
                  className="native-date-time-input block w-full min-w-0 max-w-full box-border"
                />
              </div>
              <fieldset disabled={busy} className="w-full min-w-0 max-w-full space-y-2">
                <legend className="mb-2 font-semibold text-app-ink">Lembretes</legend>
                <div className="w-full min-w-0 max-w-full">
                  <Label htmlFor="horario-agendamento">
                    Horário de Brasília <span className="font-normal text-app-secondary">- {lembretes.length ? 'Obrigatório' : 'Opcional'}</span>
                  </Label>
                  <Input id="horario-agendamento" type="time" value={horarioLocal} required={lembretes.length > 0}
                    onChange={event => { setHorarioLocal(event.target.value); setHorarioError('') }}
                    error={horarioError} errorId="horario-agendamento-error" aria-invalid={Boolean(horarioError)}
                    containerClassName="w-full min-w-0 max-w-full"
                    className="native-date-time-input block w-full min-w-0 max-w-full box-border" />
                </div>
                <div className="flex flex-col">
                  {reminderOptions.map(option => (
                    <label key={option.value} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-app-ink">
                      <input type="checkbox" checked={lembretes.includes(option.value)}
                        onChange={event => setLembretes(current => event.target.checked ? [...current, option.value] : current.filter(value => value !== option.value))}
                        className="h-4 w-4 accent-primary app:accent-app-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary app:focus-visible:outline-app-accent" />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {agendamentoError && <p role="alert" className="text-sm text-app-danger">{agendamentoError}</p>}
              <div className="flex min-w-0 max-w-full flex-wrap gap-2">
                <Button variant="secondary" className="min-h-11 flex-1 basis-24" onClick={closeModal} disabled={busy}>
                  Cancelar
                </Button>
                <Button id="agendar-treino-submit" className="min-h-11 flex-1 basis-24" onClick={handleAgendar} disabled={busy}>
                  {agendando ? <ActionLoading label="Agendando..." inverse /> : 'Agendar'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
