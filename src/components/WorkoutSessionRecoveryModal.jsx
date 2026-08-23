import Modal from './ui/Modal'
import Button from './ui/Button'
import ActionLoading from './ui/ActionLoading'

export default function WorkoutSessionRecoveryModal({
  sessao,
  processando = false,
  onContinuar,
  onCancelar,
}) {
  return (
    <Modal open={Boolean(sessao)} size="md">
      <div className="space-y-5 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
          <i className="fa-solid fa-rotate" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Você já tem um treino em andamento
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Apenas uma sessão pode permanecer ativa. Continue o treino existente ou cancele-o antes de iniciar este.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="flex-1"
            onClick={onContinuar}
            disabled={processando}
          >
            Continuar treino
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={onCancelar}
            disabled={processando}
          >
            {processando ? <ActionLoading label="Cancelando…" inverse /> : 'Cancelar sessão'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
