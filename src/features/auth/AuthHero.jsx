import { motion } from 'framer-motion'
import { authEntrance } from './authMotion'

export default function AuthHero({ reducedMotion }) {
  return (
    <header className="auth-hero">
      <motion.h1 {...authEntrance(reducedMotion, 12)}>Seu próximo sucesso<br />está na sua próxima decisão.</motion.h1>
      <motion.p {...authEntrance(reducedMotion, 8, 0.04)}>
        Organize seu treino, acompanhe sua evolução e continue de onde parou.
      </motion.p>
    </header>
  )
}
