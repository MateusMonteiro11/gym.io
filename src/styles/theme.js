/** Design tokens — single source for Tailwind + UI kit */
export const theme = {
  colors: {
    primary: { DEFAULT: '#1457F7', hover: '#0F4AD4', muted: '#E8EFFE' },
    surface: { DEFAULT: '#FFFFFF', muted: '#F8FAFC', canvas: '#F1F5F9' },
    text: { DEFAULT: '#0F172A', muted: '#475569', subtle: '#64748B' },
    border: { DEFAULT: '#E2E8F0', strong: '#CBD5E1' },
    danger: { DEFAULT: '#DC2626', muted: '#FEF2F2' },
    success: { DEFAULT: '#059669', muted: '#ECFDF5' },
    warning: { DEFAULT: '#D97706', muted: '#FFFBEB' },
  },
}

export const ui = {
  pageTitle: 'text-3xl font-semibold tracking-tight text-slate-900',
  pageSubtitle: 'text-slate-600 text-sm mt-1',
  sectionTitle: 'text-xl font-semibold text-slate-900',
  sectionSubtitle: 'text-slate-600 text-sm mt-1',
  input:
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20',
  label: 'block text-sm font-medium text-slate-700 mb-1.5',
  card: 'bg-white rounded-2xl border border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md hover:border-slate-300',
  cardPadding: 'p-6',
  overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4',
  modalPanel:
    'w-full bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-modal-in',
  btnPrimary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-hover cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 cursor-pointer disabled:opacity-50',
  btnGhost:
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 cursor-pointer',
  btnDanger:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-700 cursor-pointer disabled:opacity-50',
  iconBtn:
    'flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 cursor-pointer',
  badge:
    'inline-flex items-center rounded-full bg-primary-muted px-2.5 py-0.5 text-xs font-medium text-primary',
  emptyIcon:
    'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-muted text-primary text-2xl',
  loadingSpinner: 'fa-solid fa-spinner animate-spin text-primary text-3xl',
}
