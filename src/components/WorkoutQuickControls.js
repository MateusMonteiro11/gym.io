import { createElement } from 'react'
import { quickActions } from '../services/push/quickWorkoutControls.js'

export default function WorkoutQuickControls({ state, busy, onAction }) {
  const actions = quickActions[state]
  if (!actions) return null
  return createElement('div', { className: 'mt-5', role: 'group', 'aria-label': 'Controles de descanso', 'aria-busy': busy },
    createElement('div', { className: 'grid grid-cols-2 gap-3' }, actions.map(([action, label], index) =>
      createElement('button', {
        key: action, type: 'button', disabled: busy, onClick: () => onAction(action),
        className: `flex min-h-12 items-center justify-center rounded-xl px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 ${
          actions.length === 1 || actions.length === 3 && index === 2 ? 'col-span-2 ' : ''}${
          index === 0 ? 'bg-white text-app-action hover:bg-white/90' : 'border border-white/35 bg-white/10 text-white hover:bg-white/20'}`,
      }, label))),
    busy ? createElement('p', { role: 'status', className: 'mt-3 text-xs text-white/90' }, 'Aguarde…') : null)
}
