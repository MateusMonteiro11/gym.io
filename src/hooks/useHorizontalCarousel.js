import { useCallback, useEffect, useRef, useState } from 'react'

export default function useHorizontalCarousel(itemsKey) {
  const railRef = useRef(null)
  const [navigation, setNavigation] = useState({ previous: false, next: false })
  const updateNavigation = useCallback(() => {
    const rail = railRef.current
    const previous = !!rail && rail.scrollLeft > 2
    const next = !!rail && rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 2
    setNavigation((current) => (
      current.previous === previous && current.next === next ? current : { previous, next }
    ))
  }, [])

  useEffect(() => {
    const rail = railRef.current
    updateNavigation()
    if (!rail) return
    rail.addEventListener('scroll', updateNavigation, { passive: true })
    const observer = new ResizeObserver(updateNavigation)
    observer.observe(rail)
    if (rail.firstElementChild) observer.observe(rail.firstElementChild)
    return () => {
      rail.removeEventListener('scroll', updateNavigation)
      observer.disconnect()
    }
  }, [itemsKey, updateNavigation])

  const scrollCards = useCallback((direction) => {
    const rail = railRef.current
    if (!rail?.firstElementChild) return
    const step = rail.firstElementChild.getBoundingClientRect().width + (parseFloat(getComputedStyle(rail).columnGap) || 0)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.scrollBy({ left: direction * step, behavior: reducedMotion ? 'instant' : 'smooth' })
  }, [])

  return { railRef, navigation, scrollCards, updateNavigation }
}
