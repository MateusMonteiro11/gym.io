export const reminderOptions = [
  { value: 'no_horario', label: 'No horário' },
  { value: 'um_dia_antes', label: '1 dia antes' },
  { value: 'dois_dias_antes', label: '2 dias antes' },
]
export function saoPauloDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now)
}
export function validateReminderTime(time, reminders) {
  if (!time) return reminders.length ? 'Escolha um horário para os lembretes.' : ''
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time) ? '' : 'Escolha um horário válido.'
}
