import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { useOutlet } from 'react-router-dom'
import { AUTH_EASE, authEntrance } from './authMotion'

function AuthFormView({ outlet, reducedMotion, onMeasure, focusOnMount }) {
  const [content] = useState(outlet)
  const [shouldFocus] = useState(focusOnMount)
  const contentRef = useRef(null)
  const isPresent = useIsPresent()

  useLayoutEffect(() => {
    if (!isPresent) return
    const element = contentRef.current
    const measure = () => onMeasure(element.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [isPresent, onMeasure])

  useEffect(() => {
    if (!shouldFocus) return
    const frame = requestAnimationFrame(() => {
      const heading = contentRef.current?.querySelector('h2')
      heading?.focus({ preventScroll: true })
      const top = heading?.getBoundingClientRect().top
      if (top < 100 || top > window.innerHeight - 100) {
        heading.scrollIntoView({ block: 'start', behavior: 'instant' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [shouldFocus])

  return (
    <motion.div ref={contentRef} className="auth-form-view"
      inert={isPresent ? undefined : ''}
      initial={reducedMotion || !shouldFocus ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 1, y: 0, transition: { duration: 0 } }
        : { opacity: 0, y: -6, transition: { duration: 0.18, ease: AUTH_EASE } }}
      transition={{ duration: reducedMotion ? 0 : 0.22, ease: AUTH_EASE }}>
      {content}
    </motion.div>
  )
}

export default function AuthCard({ mode, reducedMotion }) {
  const outlet = useOutlet()
  const mounted = useRef(false)
  const [height, setHeight] = useState(null)
  const onMeasure = useCallback((nextHeight) => setHeight(nextHeight), [])

  useEffect(() => { mounted.current = true }, [])

  const form = <AuthFormView key={mode} outlet={outlet} reducedMotion={reducedMotion}
    onMeasure={onMeasure} focusOnMount={mounted.current} />

  return (
    <motion.section className={`auth-card auth-card--${mode}`} aria-labelledby="auth-form-title"
      {...authEntrance(reducedMotion, 10, 0.08)}>
      <motion.div className="auth-card-height" initial={false}
        animate={{ height: reducedMotion ? 'auto' : height ?? 'auto' }}
        transition={{ duration: reducedMotion ? 0 : 0.24, ease: AUTH_EASE }}>
        <AnimatePresence initial={false} mode="wait">{form}</AnimatePresence>
      </motion.div>
    </motion.section>
  )
}
