import { useState, useEffect, useId } from 'react'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import Input, { Label } from './ui/Input'
import Button from './ui/Button'
import ActionLoading from './ui/ActionLoading'

function normalizarDescanso(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Math.min(3600, Math.max(0, Math.trunc(numero))) : 0
}

export default function PreWorkoutModal({
  open,
  treino,
  descansoPadrao = 60,
  onClose,
  onStart,
  processando = false,
}) {
  const [descansoTexto, setDescansoTexto] = useState(() => String(normalizarDescanso(descansoPadrao)))
  const descansoInputId = useId()
  const descanso = normalizarDescanso(descansoTexto)

  useEffect(() => {
    if (open) setDescansoTexto(String(normalizarDescanso(descansoPadrao)))
  }, [open, descansoPadrao])

  return (
    <Modal open={open} onClose={processando ? undefined : onClose} size="md">
      <ModalHeader
        title="Iniciar treino"
        subtitle={treino?.nome ? `Treino: ${treino.nome}` : 'Configure o descanso padrão'}
        onClose={processando ? undefined : onClose}
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-4 gap-2">
          {[30, 45, 60, 90].map((tempo) => (
            <button
              key={tempo}
              type="button"
              onClick={() => setDescansoTexto(String(tempo))}
              disabled={processando}
              className={`cursor-pointer rounded-xl py-3 text-sm font-semibold transition-colors duration-200 ${
                descansoTexto !== '' && descanso === tempo
                  ? 'bg-app-action text-white'
                  : 'bg-app-muted text-app-secondary hover:bg-app-muted'
              }`}
            >
              {tempo}s
            </button>
          ))}
        </div>
        <div>
          <Label htmlFor={descansoInputId}>Descanso personalizado (segundos)</Label>
          <Input
            id={descansoInputId}
            type="number"
            min="0"
            max="3600"
            step="1"
            inputMode="numeric"
            value={descansoTexto}
            onChange={(e) => setDescansoTexto(e.target.value)}
            onBlur={() => setDescansoTexto(String(normalizarDescanso(descansoTexto)))}
            disabled={processando}
            className="mt-2"
          />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={processando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => onStart(descanso)} disabled={processando}>
            {processando ? (
              <ActionLoading label="Iniciando…" inverse />
            ) : (
              <>
                <i className="fa-solid fa-play text-white" />
                Começar
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
