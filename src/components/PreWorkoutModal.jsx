import { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import Input, { Label } from './ui/Input'
import Button from './ui/Button'

export default function PreWorkoutModal({ open, treino, descansoPadrao = 60, onClose, onStart }) {
  const [descanso, setDescanso] = useState(descansoPadrao)

  useEffect(() => {
    if (open) setDescanso(descansoPadrao)
  }, [open, descansoPadrao])

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader
        title="Iniciar treino"
        subtitle={treino?.nome ? `Treino: ${treino.nome}` : 'Configure o descanso padrão'}
        onClose={onClose}
      />
      <div className="space-y-6 p-6 pt-0">
        <div className="grid grid-cols-4 gap-2">
          {[30, 45, 60, 90].map((tempo) => (
            <button
              key={tempo}
              type="button"
              onClick={() => setDescanso(tempo)}
              className={`cursor-pointer rounded-xl py-3 text-sm font-semibold transition-colors duration-200 ${
                descanso === tempo
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {tempo}s
            </button>
          ))}
        </div>
        <div>
          <Label>Descanso personalizado (segundos)</Label>
          <Input
            type="number"
            min="0"
            value={descanso}
            onChange={(e) => setDescanso(Number(e.target.value))}
            className="mt-2"
          />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => onStart(descanso)}>
            <i className="fa-solid fa-play text-white" /> Começar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
