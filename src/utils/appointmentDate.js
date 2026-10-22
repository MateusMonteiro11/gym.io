import { validateScheduleDate } from './dateUtils.js'

export function appointmentDateFromSearch(search, today) {
  const values = new URLSearchParams(search).getAll('date')
  return values.length === 1 && validateScheduleDate(values[0], today).isValid ? values[0] : today
}
