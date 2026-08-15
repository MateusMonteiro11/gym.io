import { useEffect, useState } from 'react'
import { useUi } from '../contexts/UiContext'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import Input, { Label } from './ui/Input'
import Button from './ui/Button'
import Card from './ui/Card'
import { getLocalDateInputValue, validateScheduleDate } from '../utils/dateUtils'

export default function AgendarTreinoModal({ open, treino, onClose, onAgendar }) {
  const { alert } = useUi()
  const [dataAgendada, setDataAgendada] = useState('')
  const [dataError, setDataError] = useState('')
  const [agendando, setAgendando] = useState(false)
  const today = getLocalDateInputValue()

  useEffect(() => {
    if (!open) {
      setDataAgendada('')
      setDataError('')
      setAgendando(false)
    }
  }, [open])

  const handleAgendar = async () => {
    const validation = validateScheduleDate(dataAgendada, today)

    if (!validation.isValid) {
      setDataError(validation.message)
      alert({ title: 'Revise a data', message: validation.message, type: 'warning' })
      return
    }

    try {
      setAgendando(true)
      await onAgendar({ dataAgendada })
    } finally {
      setAgendando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      overlayClassName="!items-end !p-0 sm:!items-center sm:!p-4"
      className="!max-h-[100dvh] !rounded-b-none !border-x-0 !border-b-0 sm:!max-h-[calc(100dvh-2rem)] sm:!rounded-2xl sm:!border"
    >
      <ModalHeader title="Agendar treino" subtitle="Escolha quando deseja realizar este treino" onClose={onClose} />
      <div className="space-y-5 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6">
        <Card className="border-slate-100 bg-slate-50 p-4 shadow-none">
          <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h3 className="break-words font-semibold text-slate-900">{treino?.nome}</h3>
              <p className="mt-1 break-words text-sm text-slate-600">{treino?.descricao || 'Sem descrição'}</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <i className="fa-solid fa-dumbbell" />
            </span>
          </div>
        </Card>
        <div className="min-w-0">
          <Label htmlFor="data-agendamento">
            <i className="fa-solid fa-calendar mr-2" />
            Data agendada
          </Label>
          <Input
            id="data-agendamento"
            type="date"
            value={dataAgendada}
            onChange={(event) => {
              const nextValue = event.target.value
              setDataAgendada(nextValue)
              setDataError(nextValue ? validateScheduleDate(nextValue, today).message : '')
            }}
            min={today}
            error={dataError}
            aria-invalid={Boolean(dataError)}
            className="mt-2"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" className="w-full sm:flex-1" onClick={onClose} disabled={agendando}>
            Cancelar
          </Button>
          <Button className="w-full sm:flex-1" onClick={handleAgendar} disabled={agendando}>
            {agendando ? (
              <>
                <i className="fa-solid fa-spinner animate-spin" />
                Agendando...
              </>
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
