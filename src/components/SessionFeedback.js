import { createElement } from 'react'

const SESSION_FEEDBACK_CLASS = [
  'fixed right-4 top-4 z-[70] w-[min(28rem,calc(100vw-2rem))]',
  'flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm shadow-lg',
].join(' ')

export default function SessionFeedback({ erro, aviso, onClose }) {
  const mensagem = erro || aviso
  if (!mensagem) return null

  const cores = erro
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950 dark:text-red-200'
    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200'

  return createElement(
    'div',
    {
      className: `${SESSION_FEEDBACK_CLASS} ${cores}`,
      role: erro ? 'alert' : 'status',
    },
    createElement('span', null, mensagem),
    createElement(
      'button',
      {
        type: 'button',
        onClick: onClose,
        'aria-label': 'Fechar aviso',
        className: 'font-bold',
      },
      '×'
    )
  )
}
