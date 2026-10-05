export const ui = {
  pageTitle: 'text-3xl font-semibold tracking-tight text-slate-900 app:text-app-ink',
  pageSubtitle: 'text-slate-600 app:text-app-secondary text-sm mt-1',
  sectionTitle: 'text-xl font-semibold text-slate-900 app:text-app-ink',
  sectionSubtitle: 'text-slate-600 app:text-app-secondary text-sm mt-1',
  input:
    'w-full rounded-lg border bg-surface app:bg-app-surface px-4 py-3 text-slate-900 app:text-app-ink placeholder:text-slate-400 app:placeholder:text-app-secondary transition-colors duration-200 dark:bg-[#080808] dark:text-slate-100 dark:placeholder:text-slate-500',
  label: 'block text-sm font-medium text-slate-700 app:text-app-ink mb-1.5 dark:text-slate-200',
  card: 'bg-surface app:bg-app-surface app:bg-none rounded-2xl border border-slate-200 app:border-app-line shadow-sm dark:border-transparent dark:bg-[linear-gradient(180deg,#101010_0%,#090909_46%,#050505_100%)] dark:shadow-black/40',
  cardHover: 'transition-shadow duration-200 hover:shadow-card-hover hover:border-slate-300 app:hover:border-app-line dark:hover:border-transparent',
  cardPadding: 'p-6',
  overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 app:bg-app-overlay backdrop-blur-sm p-4 dark:bg-black/75',
  modalPanel:
    'w-full bg-surface app:bg-app-surface rounded-2xl shadow-2xl border border-slate-200 app:border-app-line max-h-[90vh] overflow-y-auto animate-modal-in app:animate-none dark:border-white/[0.06] dark:bg-[#080808] dark:shadow-black/60',
  btnPrimary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-primary app:bg-app-action px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-hover app:hover:bg-app-action-hover cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 app:border-app-line bg-surface app:bg-app-surface px-4 py-2 text-sm font-semibold text-slate-700 app:text-app-ink transition-colors duration-200 hover:bg-slate-50 app:hover:bg-app-muted cursor-pointer disabled:opacity-50 dark:border-white/[0.06] dark:bg-[#101010] dark:text-slate-100 dark:hover:bg-[#181818]',
  btnGhost:
    'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 app:text-app-secondary transition-colors duration-200 hover:bg-slate-100 app:hover:bg-app-muted cursor-pointer dark:text-slate-300 dark:hover:bg-[#101010] dark:hover:text-white',
  btnDanger:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-danger app:bg-app-danger-action px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-700 app:hover:bg-app-danger-hover cursor-pointer disabled:opacity-50',
  iconBtn:
    'flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 app:text-app-secondary transition-colors duration-200 hover:bg-slate-100 app:hover:bg-app-muted hover:text-slate-700 app:hover:text-app-ink cursor-pointer dark:text-slate-400 dark:hover:bg-[#101010] dark:hover:text-white',
  badge:
    'inline-flex items-center rounded-full bg-primary-muted app:bg-app-selection px-2.5 py-0.5 text-xs font-medium text-primary app:text-app-accent',
  emptyIcon:
    'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-muted app:bg-app-selection text-primary app:text-app-accent text-2xl',
}
