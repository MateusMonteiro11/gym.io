import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

const NavigationScrollContext = createContext(null)

function pageScroller(content, doc) {
  for (let element = content; element && element !== doc.documentElement; element = element.parentElement) {
    if (element.scrollHeight > element.clientHeight + 1 && /(auto|scroll|overlay)/.test(doc.defaultView.getComputedStyle(element).overflowY)) return element
  }
  return doc.scrollingElement || doc.documentElement
}

function editingField(element) {
  if (!element) return false
  if (element.isContentEditable || element.closest('[contenteditable="true"]')) return true
  if (element.matches('textarea, select')) return true
  return element.matches('input') && !/^(button|submit|reset|checkbox|radio|range|file|color|hidden|image)$/.test(element.type)
}

function createSource() {
  let latest = null
  const listeners = new Set()
  return {
    read: () => latest,
    cached: () => latest,
    subscribe(listener) {
      listeners.add(listener)
      const snapshot = this.read()
      if (snapshot) listener(snapshot)
      return () => listeners.delete(listener)
    },
    publish(snapshot) {
      if (latest && Object.keys(snapshot).every((key) => snapshot[key] === latest[key])) return
      latest = snapshot
      listeners.forEach((listener) => listener(snapshot))
    },
  }
}

export function NavigationScrollProvider({ contentRef, children }) {
  const source = useMemo(createSource, [])

  useLayoutEffect(() => {
    const doc = contentRef.current.ownerDocument
    const view = doc.defaultView
    let frame = 0

    const read = () => {
      const target = pageScroller(contentRef.current, doc)
      const viewportHeight = target.clientHeight
      const maxScroll = Math.max(0, target.scrollHeight - viewportHeight)
      const scrollLocked = [doc.body, doc.documentElement].some((element) => (
        /hidden|clip/.test(view.getComputedStyle(element).overflowY)
      ))
      return {
        target,
        viewportHeight,
        maxScroll,
        position: Math.max(0, Math.min(target.scrollTop, maxScroll)),
        blocked: scrollLocked || editingField(doc.activeElement) || Boolean(doc.querySelector('[aria-modal="true"], dialog[open]')),
      }
    }

    const publish = () => {
      frame = 0
      source.publish(read())
    }
    const schedule = () => {
      if (!frame) frame = view.requestAnimationFrame(publish)
    }

    source.read = read
    publish()

    doc.addEventListener('scroll', schedule, { capture: true, passive: true })
    doc.addEventListener('focusin', schedule)
    doc.addEventListener('focusout', schedule)
    view.addEventListener('resize', schedule, { passive: true })
    view.visualViewport?.addEventListener('resize', schedule, { passive: true })

    const dialogs = new view.MutationObserver(schedule)
    dialogs.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'open'] })
    const locks = new view.MutationObserver(schedule)
    locks.observe(doc.body, { attributes: true, attributeFilter: ['style'] })
    locks.observe(doc.documentElement, { attributes: true, attributeFilter: ['style'] })

    const resize = view.ResizeObserver ? new view.ResizeObserver(schedule) : null
    resize?.observe(contentRef.current)
    if (contentRef.current.firstElementChild) resize?.observe(contentRef.current.firstElementChild)

    return () => {
      if (frame) view.cancelAnimationFrame(frame)
      doc.removeEventListener('scroll', schedule, true)
      doc.removeEventListener('focusin', schedule)
      doc.removeEventListener('focusout', schedule)
      view.removeEventListener('resize', schedule)
      view.visualViewport?.removeEventListener('resize', schedule)
      dialogs.disconnect()
      locks.disconnect()
      resize?.disconnect()
      source.read = source.cached
    }
  }, [contentRef, source])

  return <NavigationScrollContext.Provider value={source}>{children}</NavigationScrollContext.Provider>
}

export function useNavigationScrollVisibility(reduceScroll, { pauseDuringInteraction = true } = {}) {
  const source = useContext(NavigationScrollContext)
  const location = useLocation()
  const routeKey = `${location.key}:${location.pathname}:${location.search}:${location.hash}`
  const [visibility, setVisibility] = useState({ hidden: false, animate: false, routeKey })

  useLayoutEffect(() => {
    let previous = null
    let state = { position: 0, anchor: 0, direction: 0, distance: 0, hidden: false }
    let animate = false
    setVisibility({ hidden: false, animate, routeKey })

    return source.subscribe((sample) => {
      const reset = !previous || previous.target !== sample.target || previous.viewportHeight !== sample.viewportHeight
      const interaction = pauseDuringInteraction && sample.blocked
      const blocked = interaction || (pauseDuringInteraction && previous?.blocked)
      const mustShow = !interaction && (sample.maxScroll <= 1 || sample.position === 0)

      if (mustShow || reset || blocked) {
        state = {
          position: sample.position, anchor: sample.position, direction: 0, distance: 0,
          hidden: mustShow ? false : state.hidden,
        }
      } else {
        animate ||= sample.position !== previous.position
        state = reduceScroll(state, sample.position, sample.maxScroll)
      }

      previous = sample
      setVisibility((current) => current.hidden === state.hidden && current.animate === animate && current.routeKey === routeKey
        ? current
        : { hidden: state.hidden, animate, routeKey })
    })
  }, [source, routeKey, reduceScroll, pauseDuringInteraction])

  return visibility.routeKey === routeKey ? visibility : { hidden: false, animate: false }
}
