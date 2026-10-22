import { useEffect, useRef } from 'react'
import ModalHeader from './ui/ModalHeader'
import Button from './ui/Button'
import ActionLoading from './ui/ActionLoading'

const guidance = {
  denied: {
    title: 'Notificações bloqueadas',
    message: 'A permissão está bloqueada. Este dispositivo não receberá a confirmação nem os lembretes do treino.',
    heading: 'Como desbloquear',
    instruction: 'Nas configurações deste site no navegador, permita Notificações.',
    detail: 'Se o Gym.io estiver instalado no iPhone ou iPad, confira Ajustes → Notificações → Gym.io.',
  },
  unsupported: {
    title: 'Notificações indisponíveis',
    message: 'Este navegador não oferece notificações nesta janela. Você ainda pode agendar seu treino.',
    heading: 'Como habilitar neste dispositivo',
    instruction: 'No iPhone ou iPad, adicione o Gym.io à Tela de Início e abra pelo ícone instalado. Em outros dispositivos, use um navegador com suporte a notificações.',
  },
  push_not_configured: {
    title: 'Notificações indisponíveis',
    message: 'A ativação de notificações ainda não está disponível no momento. Seu agendamento pode continuar normalmente.',
    heading: 'O que fazer',
    instruction: 'Dentro do aplicativo, habilite as notificações pelo perfil.',
  },
  error: {
    title: 'Não foi possível verificar',
    message: 'Não conseguimos confirmar se as notificações estão habilitadas neste dispositivo.',
    heading: 'Verifique a conexão',
    instruction: 'Confira sua conexão. Você também pode ativar as notificações pelo perfil.',
  },
  activation_failed: {
    title: 'Notificações não ativadas',
    message: 'Não foi possível concluir a ativação. Seu agendamento ainda não foi salvo.',
    heading: 'Confira a permissão',
    instruction: 'Confira a permissão de notificações no navegador ou continue o agendamento sem notificações.',
  },
}

export default function SchedulingNotificationPrompt({
  status, busy, enabling, failed,
  onEnable, onContinue, onClose,
}) {
  const container = useRef(null)
  const subscribed = status === 'subscribed'
  const canEnable = !failed && ['default', 'granted', 'unsubscribed'].includes(status)
  const reason = failed && !['denied', 'unsupported', 'push_not_configured'].includes(status)
    ? 'activation_failed' : status
  const view = subscribed ? {
    title: 'Notificações ativadas',
    message: 'As notificações estão habilitadas neste dispositivo. Confirme abaixo para agendar seu treino.',
  } : canEnable ? {
    title: 'Ative as notificações',
    message: 'Receba a confirmação e os lembretes deste treino no dispositivo que você está usando.',
    heading: 'Como ativar',
    instruction: 'Toque em Ativar notificações e permita o envio quando o navegador perguntar.',
  } : guidance[reason] ?? guidance.error

  useEffect(() => {
    if (busy) container.current?.focus()
    else container.current?.querySelector('button')?.focus()
  }, [busy])

  return (
    <div ref={container} tabIndex={-1} className="outline-none" aria-busy={busy}>
      <ModalHeader title={view.title} subtitle="Lembretes neste dispositivo" onClose={busy ? undefined : onClose} />
      <div className="space-y-3 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <p className="text-sm leading-relaxed text-app-secondary" aria-live="polite">{view.message}</p>
        {!subscribed && (
          <div className="space-y-1.5 text-sm leading-relaxed">
            <p className="font-medium text-app-ink">{view.heading}</p>
            <p className="text-app-secondary">{view.instruction}</p>
            {view.detail && <p className="text-app-secondary">{view.detail}</p>}
            <p className="text-app-secondary">No Gym.io, gerencie em <strong className="font-medium text-app-ink">Perfil → Notificações</strong>.</p>
          </div>
        )}
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:justify-end">
          {!canEnable && <Button variant="secondary" className="min-h-11" onClick={onClose} disabled={busy}>Voltar</Button>}
          <Button variant={canEnable ? 'secondary' : 'primary'} className="min-h-11" onClick={onContinue} disabled={busy}>
            {subscribed ? 'Agendar treino' : 'Agendar sem notificações'}
          </Button>
          {canEnable && (
            <Button className="min-h-11" onClick={onEnable} disabled={busy}>
              {enabling ? <ActionLoading label="Ativando notificações..." inverse /> : 'Ativar notificações'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
