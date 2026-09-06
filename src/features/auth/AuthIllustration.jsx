import { motion } from 'framer-motion'
import introSmall from '@/assets/images/auth-intro-640.webp'
import introLarge from '@/assets/images/auth-intro-1024.webp'
import { authEntrance } from './authMotion'

export default function AuthIllustration({ reducedMotion }) {
  return (
    <motion.picture className="auth-illustration relative block aspect-square w-[min(100%,76vh,760px)] [align-self:start] justify-self-start overflow-hidden rounded-[24px] max-[1023px]:hidden"
      {...authEntrance(reducedMotion, 8, 0.12)}>
      <source media="(min-width: 1024px)" srcSet={`${introSmall} 640w, ${introLarge} 1024w`} sizes="(min-width: 1467px) min(695px, 76vh), min(48vw, 76vh, 760px)" />
      <img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
        className="absolute inset-0 block h-full w-full object-cover object-center"
        width="1024" height="1024" decoding="async"
        alt="Academia iluminada com pessoas correndo na esteira, pulando corda e se alongando, ilustradas nas cores do Gym.io." />
    </motion.picture>
  )
}
