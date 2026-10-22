import { useState } from 'react'
import Button from './ui/Button'
import { usePushNotifications } from '../hooks/usePushNotifications'

const messages = {
  unsupported: 'Este navegador não oferece Web Push neste contexto.',
  default: 'Ative as notificações neste navegador quando desejar.',
  granted: 'Permissão concedida. Ative para vincular este navegador à conta.',
  denied: 'Notificações bloqueadas. Altere a permissão nas configurações do navegador.',
  subscribed: 'Este navegador está vinculado à sua conta.',
  unsubscribed: 'Notificações desativadas neste navegador.',
  error: 'Não foi possível concluir a operação. Tente novamente.',
}

export default function PushNotificationSettings() {
  const push = usePushNotifications()
  const [feedback, setFeedback] = useState('')
  const act = async (operation) => {
    setFeedback('')
    const result = await operation()
    const notices = []
    if (result?.warnings?.includes('rotated_subscription_cleanup_failed')) notices.push('Este navegador foi ativado, mas não foi possível remover o vínculo anterior no backend.')
    if (result?.warnings?.some((warning) => !['push_registration_unconfirmed', 'rotated_subscription_cleanup_failed'].includes(warning))) notices.push('Limpeza parcial: algum vínculo pode continuar no backend ou no navegador. A contenção local foi tentada; você pode tentar desativar novamente.')
    setFeedback(notices.join(' '))
  }
  const unconfigured = push.error === 'push_not_configured'
  const statusMessage = push.error === 'push_registration_unconfirmed'
    ? 'Não foi possível confirmar o vínculo deste navegador. A operação não foi repetida. Você pode tentar ativar novamente ou desativar neste navegador.'
    : messages[push.status]
  return (
    <section className="space-y-4" aria-label="Notificações">
      <h3 className="text-lg font-semibold text-app-ink">Notificações neste navegador</h3>
      <p className="text-sm text-app-secondary">{unconfigured ? 'Notificações ainda não estão configuradas neste ambiente.' : statusMessage}</p>
      <p className="text-sm text-app-secondary">Receba lembretes dos seus treinos agendados. Ao sair da conta, tentamos desativá-los neste navegador.</p>
      <div className="space-y-2 text-sm text-app-secondary">
        <p>Para receber notificações no celular, adicione o Gym.io à Tela de Início e abra o aplicativo pelo ícone instalado.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => act(push.enable)} disabled={push.busy || unconfigured || ['unsupported', 'denied', 'subscribed'].includes(push.status)}>Ativar notificações</Button>
        <Button variant="secondary" onClick={() => act(push.disable)} disabled={push.busy || push.status === 'unsupported'}>Desativar neste navegador</Button>
      </div>
      <p role="status" className="text-sm text-app-secondary">{push.busy ? 'Aguarde…' : feedback}</p>
    </section>
  )
}
