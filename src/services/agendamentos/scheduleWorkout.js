import { reminderOptions } from '../../utils/appointmentReminders.js'

export async function scheduleWorkout({ create, bridge, input, notify }) {
  const account = bridge.captureLogoutEpoch()
  let captured = null
  try { captured = await bridge.capture() } catch { /* Agendamento não necessariamente requer notificações ativas */ }
  const result = await create(input)
  if (!bridge.isCurrentLogoutEpoch(account)) return result
  let shown = false
  try {
    shown = await bridge.confirmSchedule({ version: 1, type: 'appointment_scheduled',
      appointment_id: result.id_agendamento, date: result.data_agendada, time: result.horario_local }, captured)
  } catch { /* O agendamento commitado deverá retornar sucesso. */ }
  if (!bridge.isCurrentLogoutEpoch(account)) return result
  if (!shown) notify({ title: 'Treino agendado', message: 'O treino foi adicionado à sua agenda.', type: 'success' })
  if (result.descartados?.length) {
    const skipped = result.descartados.map(item => reminderOptions.find(option => option.value === item.tipo)?.label).filter(Boolean)
    notify({ title: 'Lembretes com horário já passado',
      message: `${skipped.join(', ')} não ${skipped.length === 1 ? 'foi criado' : 'foram criados'}. O treino continua agendado.`, type: 'warning' })
  }
  return result
}
