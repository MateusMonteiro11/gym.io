import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import logoBlueImg from '../../assets/images/logo_blue.png'

const shellVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.32, ease: 'easeOut', staggerChildren: 0.08 },
  },
}

const panelVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function AuthShell({ brand, form }) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-canvas px-4 py-6 md:px-8 md:py-8 flex items-center justify-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,87,247,0.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(20,87,247,0.12),transparent_26%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(20,87,247,0.10),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(20,87,247,0.035),transparent_24%),linear-gradient(180deg,#020202_0%,#050505_56%,#010101_100%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute left-6 top-20 hidden h-28 w-28 rounded-full border border-primary/20 bg-primary/5 blur-2xl md:block" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 right-8 hidden h-36 w-36 rounded-full border border-primary/15 bg-primary/5 blur-3xl md:block" aria-hidden />

      <motion.article
        initial="hidden"
        animate="visible"
        variants={shellVariants}
        className="relative mx-auto grid w-full max-w-[min(95vw,60rem)] min-h-[min(85vh,calc(100vh-4rem))] overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-2xl shadow-blue-900/10 ring-1 ring-slate-200/70 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#080808]/95 dark:ring-white/[0.06] lg:grid-cols-[0.95fr_1.05fr]"
      >
        <motion.aside
          variants={panelVariants}
        className="relative flex flex-col justify-start overflow-hidden bg-gradient-to-br from-primary via-[#0f4ad4] to-[#0b3fb8] p-6 text-white md:p-10 lg:p-12"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.12),transparent_24%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.06),transparent_22%)]" aria-hidden />

          <div className="relative z-10 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3" aria-label="Voltar para a página inicial">
              <img src={logoBlueImg} alt="" className="h-11 w-11 rounded-2xl border-2 border-white/40" />
              <span className="text-base font-semibold tracking-tight text-white">GYM.IO</span>
            </Link>
          </div>

          <div className="relative z-10 flex items-start mt-14 md:mt-[4.5rem] lg:mt-[5.5rem]">
            <div className="max-w-xl">
              {brand}
            </div>
          </div>
        </motion.aside>

        <motion.section
          variants={panelVariants}
          className="relative bg-white/95 p-6 sm:p-8 md:p-10 lg:p-12 dark:bg-[#050505]/95 flex items-center"
        >
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" aria-hidden />
          {form}
        </motion.section>
      </motion.article>
    </section>
  )
}