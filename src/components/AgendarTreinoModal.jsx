import { useEffect, useState } from 'react'
import { useUi } from '../contexts/UiContext'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import Input, { Label } from './ui/Input'
import Button from './ui/Button'
import Card from './ui/Card'

export default function AgendarTreinoModal({ open, treino, onClose, onAgendar }) {
  const { alert } = useUi()
  const [dataAgendada, setDataAgendada] = useState('')
  const [agendando, setAgendando] = useState(false)

  useEffect(() => {
    if (!open) {
      setDataAgendada('')
      setAgendando(false)
    }
  }, [open])

  const handleAgendar = async () => {
    if (!dataAgendada) {
      alert({ title: 'Data obrigatória', message: 'Preencha a data do agendamento.', type: 'warning' })
      return
    }
    try {
      setAgendando(true)
      await onAgendar({ dataAgendada })
      setDataAgendada('')
    } finally {
      setAgendando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title="Agendar treino" subtitle="Escolha quando deseja realizar este treino" onClose={onClose} />
      <div className="space-y-6 p-6">
        <Card className="border-slate-100 bg-slate-50 p-4 shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">{treino?.nome}</h3>
              <p className="mt-1 text-sm text-slate-600">{treino?.descricao || 'Sem descrição'}</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <i className="fa-solid fa-dumbbell" />
            </span>
          </div>
        </Card>
        <div>
          <Label>
            <i className="fa-solid fa-calendar mr-2" />
            Data agendada
          </Label>
          <Input
            type="date"
            value={dataAgendada}
            onChange={(e) => setDataAgendada(e.target.value)}
            min={new Date().toLocaleDateString('sv-SE')}
            className="mt-2"
          />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={agendando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleAgendar} disabled={agendando}>
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
