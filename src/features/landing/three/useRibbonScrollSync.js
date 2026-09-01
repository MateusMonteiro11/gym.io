import { useCallback, useEffect, useRef, useState } from 'react'
import { ribbonChapters, ribbonDataAnchors, ribbonWaypoints } from './ribbonChapters'
import {
  createRibbonDataAnchorLayout,
  getRibbonDataAnchorChecksum,
} from './ribbonDataAnchors'
import { createRibbonGeometry, getRibbonRevealState } from './ribbonGeometry'
import { getStaticOffsetTop, getStaticPageTop } from './ribbonLayout'
import { resolveRibbonCorridors } from './ribbonPath'
import { getRibbonProfile } from './ribbonProfiles'
import { mapScrollToRibbonU } from './ribbonTimeline'
import {
  getRibbonScrollSnapshot,
  nextLayoutEpoch,
  RIBBON_BOOTSTRAP_REASON,
  shouldRecoverFragment,
} from './ribbonBootstrap'

const emptySnapshot = {
  rawScroll: 0,
  progress: 0,
  rawVelocity: 0,
  lastInputTime: 0,
  initialized: false,
}

function visibleElement(root, selector, index = 0) {
  if (!selector) return null
  const candidates = Array.from(root.querySelectorAll(selector))
  const visible = candidates.filter((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 1 && rect.height > 1
  })
  return visible[index] ?? visible.at(-1) ?? candidates[index] ?? candidates.at(-1) ?? null
}

function measureWaypoints(root, chapterMap, viewportWidth, profile, rootTop) {
  return ribbonWaypoints.map((waypoint) => {
    const chapter = chapterMap.get(waypoint.chapter)
    if (!chapter) return null
    const anchor = visibleElement(root, waypoint.selector, waypoint.selectorIndex ?? 0)
    const rect = anchor?.getBoundingClientRect()
    const pageAnchor = visibleElement(root, waypoint.pageSelector, waypoint.pageSelectorIndex ?? 0)
    const pageRect = pageAnchor?.getBoundingClientRect()
    const fallbackX = waypoint.fallbackX ?? .5
    const responsiveViewportX = profile.key === 'tablet'
      ? waypoint.tabletX
      : (profile.key === 'mobile' || profile.key === 'small-mobile')
        ? waypoint.mobileX
        : undefined
    const x = Number.isFinite(responsiveViewportX)
      ? responsiveViewportX * viewportWidth
      : Number.isFinite(waypoint.viewportX)
      ? waypoint.viewportX * viewportWidth
      : rect?.width > 1
        ? rect.left + rect.width * (waypoint.anchorX ?? .5) + (waypoint.offsetX ?? 0) * viewportWidth
        : fallbackX * viewportWidth

    const pageY = pageRect?.height > 1
      ? getStaticPageTop(pageAnchor, rootTop) + pageRect.height * (waypoint.anchorY ?? 0)
      : chapter.top + chapter.height * waypoint.sectionY

    return {
      ...waypoint,
      x,
      pageY,
    }
  }).filter(Boolean)
}

function toPageRect(rect, rootTop, fixed = false) {
  const top = fixed ? 0 : rect.top + window.scrollY - rootTop
  return {
    top,
    bottom: top + rect.height,
    left: rect.left,
    right: rect.left + rect.width,
    width: rect.width,
    height: rect.height,
  }
}

function getTextContentRect(element) {
  const textRects = []
  const visit = (node) => {
    if (node.nodeType === 3 && node.textContent?.trim()) {
      const range = document.createRange()
      range.selectNodeContents(node)
      const rect = range.getBoundingClientRect()
      if (rect.width > 1 && rect.height > 1) textRects.push(rect)
      return
    }
    node.childNodes?.forEach(visit)
  }
  visit(element)
  if (!textRects.length) return element.getBoundingClientRect()

  const left = Math.min(...textRects.map((rect) => rect.left))
  const right = Math.max(...textRects.map((rect) => rect.right))
  const top = Math.min(...textRects.map((rect) => rect.top))
  const bottom = Math.max(...textRects.map((rect) => rect.bottom))
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

function measureRibbonData(root, rootTop) {
  const hero = root.querySelector('[data-ribbon-chapter="hero"]')
  const heroRect = hero?.getBoundingClientRect()
  if (!heroRect) return null
  const nodes = {}
  const exclusions = {}

  ribbonDataAnchors.forEach((anchor) => {
    const node = root.querySelector(anchor.selector)
    const rect = node?.getBoundingClientRect()
    if (rect?.width > 1 && rect?.height > 1) {
      nodes[anchor.id] = { width: rect.width, height: rect.height }
    }
    anchor.collisionSelectors.forEach((selector) => {
      if (exclusions[selector]) return
      const element = root.querySelector(selector)
      const exclusionRect = element
        ? selector === '.landing-header'
          ? element.getBoundingClientRect()
          : getTextContentRect(element)
        : null
      if (exclusionRect?.width > 1 && exclusionRect?.height > 1) {
        exclusions[selector] = toPageRect(
          exclusionRect,
          rootTop,
          selector === '.landing-header',
        )
      }
    })
  })

  return {
    hero: toPageRect(heroRect, rootTop),
    nodes,
    exclusions,
  }
}

function publishRibbonData(root, anchors, viewportWidth) {
  const mode = viewportWidth <= 720 ? 'compact' : 'path'
  root.dataset.ribbonDataMode = mode
  anchors.forEach((anchor) => {
    if (!Number.isFinite(anchor.heroX) || !Number.isFinite(anchor.heroY)) return
    root.style.setProperty(`--ribbon-data-${anchor.id}-x`, `${anchor.heroX.toFixed(2)}px`)
    root.style.setProperty(`--ribbon-data-${anchor.id}-y`, `${anchor.heroY.toFixed(2)}px`)
  })
  root.dataset.ribbonDataReady = 'true'
}

function getLayoutSignature(layout) {
  const chapterSignature = layout.chapters
    .map(({ id, top, height }) => `${id}:${Math.round(top)}:${Math.round(height)}`)
    .join('|')
  const waypointSignature = layout.waypoints
    .map(({ id, x, pageY }) => `${id}:${Math.round(x)}:${Math.round(pageY)}`)
    .join('|')
  const dataSignature = layout.dataMeasurements
    ? [
      ...Object.entries(layout.dataMeasurements.nodes)
        .map(([id, rect]) => `${id}:${Math.round(rect.width)}:${Math.round(rect.height)}`),
      ...Object.entries(layout.dataMeasurements.exclusions)
        .map(([id, rect]) => `${id}:${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`),
    ].join('|')
    : ''
  return [
    layout.profile.key,
    Math.round(layout.viewportWidth),
    Math.round(layout.viewportHeight),
    Math.round(layout.rootHeight),
    layout.displayDpr,
    chapterSignature,
    waypointSignature,
    dataSignature,
  ].join('|')
}

export default function useRibbonScrollSync({ rootRef, sceneRef, skipFragmentRecovery = false }) {
  const stateRef = useRef({ ...emptySnapshot })
  const frameRequesterRef = useRef(null)
  const visibleRef = useRef(true)
  const prepareFrameRef = useRef(0)
  const prepareGenerationRef = useRef(0)
  const previousRef = useRef({ position: 0, time: performance.now() })
  const rootTopRef = useRef(0)
  const recoveredHashRef = useRef('')
  const skipFragmentRecoveryRef = useRef(skipFragmentRecovery)
  const layoutRef = useRef(null)
  const signatureRef = useRef('')
  const epochRef = useRef(0)
  const snapshotRef = useRef(null)
  const [snapshot, setSnapshot] = useState(null)
  skipFragmentRecoveryRef.current = skipFragmentRecovery

  const requestFrame = useCallback(() => {
    if (visibleRef.current) frameRequesterRef.current?.()
  }, [])

  const setFrameRequester = useCallback((requester) => {
    frameRequesterRef.current = requester
    requester?.()
    return () => {
      if (frameRequesterRef.current === requester) frameRequesterRef.current = null
    }
  }, [])

  useEffect(() => {
    const root = rootRef?.current
    const scene = sceneRef?.current
    if (!root || !scene) return undefined

    let disposed = false
    let layoutSettleTimer = 0
    let pendingLayoutInvalidation = ''
    let deferLayoutUntilScroll = false
    const observedWidths = new WeakMap()
    const observedHeights = new WeakMap()
    const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve))

    const measureLayout = () => {
      // Framer Motion may leave off-screen Reveal wrappers in their initial
      // translated/scaled state. Measure the authored layout box, not that
      // transient presentation transform, so direct fragment loads and normal
      // top-down navigation generate the exact same centerline.
      root.classList.add('is-ribbon-measuring')
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth
      const measuredSceneHeight = scene.offsetHeight || scene.getBoundingClientRect().height
      const viewportHeight = measuredSceneHeight > 0
        ? measuredSceneHeight / 1.5
        : document.documentElement.clientHeight || window.innerHeight
      const rootTop = root.getBoundingClientRect().top + window.scrollY
      const rootHeight = root.scrollHeight
      const profile = getRibbonProfile(viewportWidth)
      const chapters = ribbonChapters.map((chapter) => {
        const element = root.querySelector(chapter.selector)
        if (!element) return null
        const rect = element.getBoundingClientRect()
        return {
          id: chapter.id,
          top: getStaticOffsetTop(element) - rootTop,
          height: rect.height,
        }
      }).filter(Boolean)
      const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]))
      const displayDpr = window.devicePixelRatio || 1
      const measuredWaypoints = measureWaypoints(
        root,
        chapterMap,
        viewportWidth,
        profile,
        rootTop,
      )
      const dataMeasurements = measureRibbonData(root, rootTop)
      const nextLayout = {
        profile,
        displayDpr,
        renderDpr: Math.min(displayDpr, profile.maxDpr),
        viewportHeight,
        viewportWidth,
        rootHeight,
        maxScroll: Math.max(1, rootHeight - viewportHeight),
        chapters,
        waypoints: resolveRibbonCorridors(
          measuredWaypoints,
          chapters,
          viewportWidth,
          viewportHeight,
        ),
        dataMeasurements,
        flow: chapterMap.get('flow') ?? null,
        progress: chapterMap.get('progress') ?? null,
        capabilities: chapterMap.get('capabilities') ?? null,
        creator: chapterMap.get('creator') ?? null,
        faq: chapterMap.get('faq') ?? null,
        cta: chapterMap.get('cta') ?? null,
      }

      const signature = getLayoutSignature(nextLayout)
      nextLayout.signature = signature
      root.classList.remove('is-ribbon-measuring')
      return { nextLayout, rootTop, signature }
    }

    const captureNativeScroll = (layoutForScroll = layoutRef.current, rootTop = rootTopRef.current) => {
      if (!layoutForScroll) return
      const now = performance.now()
      const next = getRibbonScrollSnapshot(
        window.scrollY,
        rootTop,
        layoutForScroll.maxScroll,
        now,
        previousRef.current,
      )
      Object.assign(stateRef.current, next)
      previousRef.current = {
        position: next.rawScroll,
        time: now,
        initialized: true,
      }
      requestFrame()
    }

    const recoverFragmentIfNeeded = async () => {
      const hash = window.location.hash
      if (!hash || recoveredHashRef.current === hash) return
      if (skipFragmentRecoveryRef.current) {
        recoveredHashRef.current = hash
        return
      }
      const targetId = decodeURIComponent(hash.slice(1))
      const target = document.getElementById(targetId)
      if (shouldRecoverFragment({ hash, scrollY: window.scrollY, target })) {
        target.scrollIntoView({ behavior: 'instant', block: 'start' })
        await nextFrame()
      }
      recoveredHashRef.current = hash
    }

    const prepareRibbonLayoutAndSync = async (reason, remeasure = true) => {
      const generation = ++prepareGenerationRef.current
      if (remeasure && document.fonts?.ready) await document.fonts.ready
      await nextFrame()
      await nextFrame()
      if (disposed || generation !== prepareGenerationRef.current) return
      await recoverFragmentIfNeeded()
      if (disposed || generation !== prepareGenerationRef.current) return

      if (!remeasure && layoutRef.current) {
        captureNativeScroll()
        scene.setAttribute('data-ribbon-bootstrap-reason', reason)
        return
      }

      const { nextLayout, rootTop, signature } = measureLayout()
      rootTopRef.current = rootTop
      if (signature === signatureRef.current && snapshotRef.current) {
        captureNativeScroll(nextLayout, rootTop)
        scene.setAttribute('data-ribbon-bootstrap-reason', reason)
        return
      }

      const layoutEpoch = nextLayoutEpoch(signatureRef.current, signature, epochRef.current)
      const geometry = createRibbonGeometry({ layout: nextLayout })
      const timeline = geometry.userData.timeline
      const dataAnchors = createRibbonDataAnchorLayout(
        nextLayout,
        geometry,
        nextLayout.dataMeasurements,
      )
      const dataAnchorChecksum = getRibbonDataAnchorChecksum(dataAnchors)
      const now = performance.now()
      const scrollState = getRibbonScrollSnapshot(
        window.scrollY,
        rootTop,
        nextLayout.maxScroll,
        now,
        previousRef.current,
      )
      const progressU = mapScrollToRibbonU(scrollState.rawScroll, timeline)
      const revealState = getRibbonRevealState(
        progressU,
        geometry.userData.segments,
        geometry.userData.widthSegments,
      )
      geometry.setDrawRange(0, revealState.drawCount)
      Object.assign(stateRef.current, scrollState)
      previousRef.current = {
        position: scrollState.rawScroll,
        time: now,
        initialized: true,
      }
      nextLayout.epoch = layoutEpoch
      nextLayout.bootstrapReason = reason
      nextLayout.initialScroll = scrollState.rawScroll
      nextLayout.initialProgressU = progressU
      nextLayout.dataAnchors = dataAnchors
      layoutRef.current = nextLayout
      signatureRef.current = signature
      epochRef.current = layoutEpoch
      const nextSnapshot = {
        layoutEpoch,
        geometryVersion: geometry.uuid,
        layout: nextLayout,
        geometry,
        timeline,
        dataAnchors,
        dataAnchorChecksum,
        scrollY: scrollState.rawScroll,
        progressU,
        ready: false,
        bootstrapReason: reason,
      }
      snapshotRef.current = nextSnapshot
      publishRibbonData(root, dataAnchors, nextLayout.viewportWidth)
      if (!scene.classList.contains('is-ready')) {
        scene.setAttribute('data-ribbon-ready', 'false')
      }
      setSnapshot(nextSnapshot)
    }

    const schedulePrepare = (reason, remeasure = true) => {
      if (prepareFrameRef.current) window.cancelAnimationFrame(prepareFrameRef.current)
      prepareFrameRef.current = window.requestAnimationFrame(() => {
        prepareFrameRef.current = 0
        prepareRibbonLayoutAndSync(reason, remeasure)
      })
    }

    const scheduleSettledPrepare = (reason, deferUntilScroll = false) => {
      if (layoutSettleTimer) window.clearTimeout(layoutSettleTimer)
      layoutSettleTimer = window.setTimeout(() => {
        layoutSettleTimer = 0
        if (deferUntilScroll) {
          pendingLayoutInvalidation = reason
          return
        }
        schedulePrepare(reason)
      }, 140)
    }

    const resizeObserver = new ResizeObserver((entries) => {
      let widthChanged = false
      let heightChanged = false
      entries.forEach((entry) => {
        const width = entry.contentRect.width
        const height = entry.contentRect.height
        const previousWidth = observedWidths.get(entry.target)
        const previousHeight = observedHeights.get(entry.target)
        if (Number.isFinite(previousWidth) && Math.abs(width - previousWidth) > 1) {
          widthChanged = true
        }
        if (Number.isFinite(previousHeight) && Math.abs(height - previousHeight) > 1) {
          heightChanged = true
        }
        observedWidths.set(entry.target, width)
        observedHeights.set(entry.target, height)
      })

      if (widthChanged) {
        if (layoutSettleTimer) window.clearTimeout(layoutSettleTimer)
        layoutSettleTimer = 0
        deferLayoutUntilScroll = false
        schedulePrepare(RIBBON_BOOTSTRAP_REASON.RESIZE)
        return
      }

      if (heightChanged) deferLayoutUntilScroll = true

      scheduleSettledPrepare(
        RIBBON_BOOTSTRAP_REASON.LAYOUT_INVALIDATION,
        deferLayoutUntilScroll,
      )
    })
    resizeObserver.observe(root)
    ribbonChapters.forEach((chapter) => {
      const element = root.querySelector(chapter.selector)
      if (element) resizeObserver.observe(element)
    })
    ribbonWaypoints.forEach((waypoint) => {
      if (!waypoint.pageSelector) return
      const element = visibleElement(root, waypoint.pageSelector, waypoint.pageSelectorIndex ?? 0)
      if (element) resizeObserver.observe(element)
    })

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
      if (entry.isIntersecting) requestFrame()
    }, { rootMargin: '100% 0px' })
    intersectionObserver.observe(root)

    let previousWidth = document.documentElement.clientWidth
    let previousOrientation = window.matchMedia('(orientation: portrait)').matches
    const onResize = () => {
      const width = document.documentElement.clientWidth
      const orientation = window.matchMedia('(orientation: portrait)').matches
      const widthChanged = Math.abs(width - previousWidth) > 1
      const orientationChanged = orientation !== previousOrientation
      if (!widthChanged && !orientationChanged) return
      previousWidth = width
      previousOrientation = orientation
      schedulePrepare(RIBBON_BOOTSTRAP_REASON.RESIZE)
    }

    const onOrientationChange = () => schedulePrepare(RIBBON_BOOTSTRAP_REASON.RESIZE)
    const onScroll = () => {
      captureNativeScroll()
      if (!pendingLayoutInvalidation && !deferLayoutUntilScroll) return
      const reason = pendingLayoutInvalidation || RIBBON_BOOTSTRAP_REASON.LAYOUT_INVALIDATION
      pendingLayoutInvalidation = ''
      deferLayoutUntilScroll = false
      schedulePrepare(reason)
    }
    const onPageShow = () => schedulePrepare(RIBBON_BOOTSTRAP_REASON.PAGE_SHOW)
    const onHashChange = () => {
      recoveredHashRef.current = ''
      schedulePrepare(RIBBON_BOOTSTRAP_REASON.HASH_CHANGE, !layoutRef.current)
    }
    const onPopState = () => {
      recoveredHashRef.current = ''
      schedulePrepare(RIBBON_BOOTSTRAP_REASON.POPSTATE, !layoutRef.current)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientationChange)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('popstate', onPopState)
    document.fonts?.ready.then(() => {
      if (!disposed) schedulePrepare(RIBBON_BOOTSTRAP_REASON.FONT_READY)
    })
    prepareRibbonLayoutAndSync(RIBBON_BOOTSTRAP_REASON.INITIAL_LOAD)

    return () => {
      disposed = true
      prepareGenerationRef.current += 1
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientationChange)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('popstate', onPopState)
      if (prepareFrameRef.current) window.cancelAnimationFrame(prepareFrameRef.current)
      if (layoutSettleTimer) window.clearTimeout(layoutSettleTimer)
    }
  }, [requestFrame, rootRef, sceneRef])

  return {
    layout: snapshot?.layout ?? null,
    snapshot,
    snapshotRef,
    layoutRef,
    stateRef,
    sceneRef,
    setFrameRequester,
  }
}
