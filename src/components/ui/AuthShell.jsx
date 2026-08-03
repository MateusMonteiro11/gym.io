import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import logoBlueImg from '../../assets/images/logo_blue.png'

const shellVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.35,
      ease: 'easeOut',
      staggerChildren: 0.08,
    },
  },
}

const panelVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

const formVariants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: 0.1 },
  },
}

export default function AuthShell({ brand, form }) {
  const { pathname } = useLocation()
  const isCadastro = pathname === '/cadastro'

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-3 md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(20,87,247,0.16),transparent_32%),radial-gradient(circle_at_84%_22%,rgba(20,87,247,0.12),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_48%,#eef5ff_100%)] dark:bg-[radial-gradient(circle_at_22%_12%,rgba(20,87,247,0.20),transparent_38%),radial-gradient(circle_at_84%_22%,rgba(20,87,247,0.12),transparent_32%),linear-gradient(180deg,#080d18_0%,#0f172a_52%,#111827_100%)]" aria-hidden />
      <motion.span
        className="pointer-events-none absolute left-8 top-24 h-24 w-24 rounded-full"
        style={{
          border: '1px solid rgba(20, 87, 247, 0.15)',
          backgroundColor: 'rgba(20, 87, 247, 0.08)',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.05)',
          backdropFilter: 'blur(8px)',
        }}
        animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <motion.span
        className="pointer-events-none absolute bottom-20 right-10 h-32 w-32 rounded-[2rem]"
        style={{
          border: '1px solid rgba(20, 87, 247, 0.12)',
          backgroundColor: 'rgba(20, 87, 247, 0.05)',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.05)',
          backdropFilter: 'blur(8px)',
        }}
        animate={{ y: [0, 14, 0], rotate: [0, -6, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      <motion.article
        key={pathname}
        initial="hidden"
        animate="visible"
        variants={shellVariants}
        className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-2xl shadow-blue-900/12 ring-1 ring-slate-200/70 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/85 dark:ring-slate-700/70 md:min-h-[82vh] md:flex-row"
      >
        <motion.aside
          variants={panelVariants}
          className="relative flex flex-col overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 p-6 dark:border-slate-700/70 md:w-1/2 md:border-b-0 md:border-r md:p-12"
        >
          <span className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(20, 87, 247, 0.12)' }} aria-hidden />
          <span className="pointer-events-none absolute bottom-10 left-8 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(20, 87, 247, 0.10)' }} aria-hidden />

          <div className="relative z-10 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3" aria-label="Voltar para a pagina inicial">
              <img src={logoBlueImg} alt="" className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-white/30" />
              <span className="text-base font-semibold tracking-tight text-white">Gym.io</span>
            </Link>
            <div className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              {isCadastro ? 'Cadastro' : 'Acesso'}
            </div>
          </div>

          <motion.div
            variants={panelVariants}
            className="relative z-10 flex flex-1 flex-col items-center justify-center py-8 text-center text-white md:py-0"
          >
            {brand}
          </motion.div>
        </motion.aside>

        <motion.section
          variants={formVariants}
          className="relative flex flex-1 flex-col justify-center bg-white/90 p-6 dark:bg-slate-950/90 sm:p-8 md:w-1/2 md:p-12"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(20,87,247,0.20)] to-transparent dark:via-[rgba(148,163,184,0.18)] md:hidden" aria-hidden />
          {form}
        </motion.section>
      </motion.article>
    </section>
  )
}
