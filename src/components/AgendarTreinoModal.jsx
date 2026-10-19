import { useEffect, useState } from 'react'
import { useUi } from '../contexts/UiContext'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import Input, { Label } from './ui/Input'
import Button from './ui/Button'
import Card from './ui/Card'
import { validateScheduleDate } from '../utils/dateUtils'
import { reminderOptions, saoPauloDate, validateReminderTime } from '../utils/appointmentReminders'
import { usePushNotifications } from '../hooks/usePushNotifications'
import ActionLoading from './ui/ActionLoading'

export default function AgendarTreinoModal({ open, treino, onClose, onAgendar }) {
  const { alert } = useUi()
  const [dataAgendada, setDataAgendada] = useState('')
  const [dataError, setDataError] = useState('')
  const [agendando, setAgendando] = useState(false)
  const [horarioLocal, setHorarioLocal] = useState('')
  const [lembretes, setLembretes] = useState([])
  const [horarioError, setHorarioError] = useState('')
  const push = usePushNotifications()
  const today = saoPauloDate()

  useEffect(() => {
    if (!open) {
      setDataAgendada('')
      setDataError('')
      setAgendando(false)
      setHorarioLocal('')
      setLembretes([])
      setHorarioError('')
    }
  }, [open])

  const handleAgendar = async () => {
    const validation = validateScheduleDate(dataAgendada, today)

    if (!validation.isValid) {
      setDataError(validation.message)
      alert({ title: 'Revise a data', message: validation.message, type: 'warning' })
      return
    }

    const timeError = validateReminderTime(horarioLocal, lembretes)
    setHorarioError(timeError)
    if (timeError) return
    try {
      setAgendando(true)
      await onAgendar({ dataAgendada, horarioLocal: horarioLocal || null, lembretes })
    } finally {
      setAgendando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={agendando ? undefined : onClose}
      ariaLabel="Agendar treino"
      size="md"
      className="min-w-0 !max-h-[calc(100dvh-2rem)] overflow-x-hidden"
    >
      <ModalHeader title="Agendar treino" subtitle="Escolha quando deseja realizar este treino" onClose={agendando ? undefined : onClose} />
      <div className="min-w-0 max-w-full space-y-5 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6">
        <Card className="min-w-0 max-w-full border-app-line bg-app-muted p-4 shadow-none">
          <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h3 className="break-words font-semibold text-app-ink">{treino?.nome}</h3>
              <p className="mt-1 break-words text-sm text-app-secondary">{treino?.descricao || 'Sem descrição'}</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-selection text-app-accent">
              <i className="fa-solid fa-dumbbell" />
            </span>
          </div>
        </Card>
        <div className="w-full min-w-0 max-w-full">
          <Label htmlFor="data-agendamento">
            <i className="fa-solid fa-calendar mr-2" />
            Data agendada
          </Label>
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
            disabled={agendando}
            error={dataError}
            errorId="data-agendamento-error"
            aria-invalid={Boolean(dataError)}
            containerClassName="w-full min-w-0 max-w-full"
            className="ios-date-input mt-2 block min-w-0 max-w-full"
          />
        </div>
        <fieldset disabled={agendando} className="min-w-0 space-y-3 border-t border-slate-200 app:border-app-line pt-5 dark:border-white/10">
          <legend className="float-left mb-3 w-full font-semibold text-slate-900 app:text-app-ink dark:text-slate-100">Lembretes</legend>
          <div className="clear-both">
            <Label htmlFor="horario-agendamento">Horário <span className="font-normal text-slate-600 app:text-app-secondary dark:text-slate-400">{lembretes.length ? '(para os lembretes)' : '(opcional)'}</span></Label>
            <Input id="horario-agendamento" type="time" value={horarioLocal}
              onChange={event => { setHorarioLocal(event.target.value); setHorarioError('') }}
              error={horarioError} errorId="horario-agendamento-error" aria-invalid={Boolean(horarioError)} aria-describedby="fuso-agendamento" className="mt-2" />
            <p id="fuso-agendamento" className="mt-2 text-xs text-slate-600 app:text-app-secondary dark:text-slate-400">Horário de São Paulo</p>
          </div>
          <p className="text-sm text-slate-600 app:text-app-secondary dark:text-slate-400">Lembrar-me:</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {reminderOptions.map(option => (
              <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-900 app:text-app-ink dark:text-slate-100">
                <input type="checkbox" checked={lembretes.includes(option.value)}
                  onChange={event => setLembretes(current => event.target.checked ? [...current, option.value] : current.filter(value => value !== option.value))}
                  className="h-4 w-4 accent-primary app:accent-app-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary app:focus-visible:outline-app-accent" />
                {option.label}
              </label>
            ))}
          </div>
          {push.status !== 'subscribed' && <p className="text-sm text-slate-600 app:text-app-secondary dark:text-slate-400">Você pode agendar normalmente. Para receber lembretes neste navegador, ative as notificações no perfil.</p>}
        </fieldset>
        <div className="flex min-w-0 max-w-full flex-col gap-3 sm:flex-row">
          <Button variant="secondary" className="w-full sm:flex-1" onClick={onClose} disabled={agendando}>
            Cancelar
          </Button>
          <Button className="w-full sm:flex-1" onClick={handleAgendar} disabled={agendando}>
            {agendando ? (
              <ActionLoading label="Agendando..." inverse />
            ) : (
              <>
                <i className="fa-solid fa-calendar-check" />
                Agendar
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
