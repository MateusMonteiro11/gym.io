import { Component, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, FrontSide, Vector3 } from 'three'
import { useReducedMotion } from 'framer-motion'
import { useTheme } from '../../../contexts/ThemeContext'
import {
  getRibbonRevealState,
  RIBBON_WORLD_HEIGHT,
} from './ribbonGeometry'
import { getEffectTarget, stepEffectChannel } from './ribbonEffects'
import { getHeroIntroReveal, shouldRunHeroIntro } from './ribbonIntro'
import useRibbonScrollSync from './useRibbonScrollSync'
import { getRibbonReveal } from './ribbonTimeline'

function getCameraDistance(profile) {
  if (profile.key === 'small-mobile' || profile.key === 'mobile') return 14.55
  if (profile.key === 'tablet') return 14.35
  return 14.1
}

function getPalette(dark) {
  return {
    active: new Color(dark ? '#4f82ff' : '#1457f7'),
    trail: new Color(dark ? '#17346f' : '#1457f7'),
    highlight: new Color(dark ? '#9bb8ff' : '#6f96ff'),
    rest: new Color(dark ? '#62c9f4' : '#168fc5'),
    memory: new Color(dark ? '#5c7ed5' : '#3b6bd1'),
  }
}

function SpatialRibbon({ dark, layout, geometry, timeline, reduced, sync }) {
  const groupRef = useRef(null)
  const shaderRef = useRef(null)
  const effectRef = useRef({ velocity: 0, direction: 1, strength: 0, idle: true })
  const introRef = useRef({ eligible: null, startedAt: 0 })
  const headPointRef = useRef(new Vector3())
  const readyRef = useRef(false)
  const timeRef = useRef(0)
  const palette = useMemo(() => getPalette(dark), [dark])
  const { invalidate } = useThree()

  const configureMaterial = useCallback((shader) => {
    shader.uniforms.uReveal = { value: sync.snapshot?.progressU ?? timeline?.initialReveal ?? .02 }
    shader.uniforms.uHeadSegmentStart = { value: 0 }
    shader.uniforms.uHeadSegmentProgress = { value: 0 }
    shader.uniforms.uViewportTop = { value: 0 }
    shader.uniforms.uEffectVelocity = { value: 0 }
    shader.uniforms.uEffectDirection = { value: 1 }
    shader.uniforms.uEffectStrength = { value: 0 }
    shader.uniforms.uRibbonTime = { value: 0 }
    shader.uniforms.uActiveColor = { value: palette.active.clone() }
    shader.uniforms.uTrailColor = { value: palette.trail.clone() }
    shader.uniforms.uHighlightColor = { value: palette.highlight.clone() }
    shader.uniforms.uRestColor = { value: palette.rest.clone() }
    shader.uniforms.uMemoryColor = { value: palette.memory.clone() }

    shader.vertexShader = `
      attribute float pathU;
      attribute vec3 aPreviousPosition;
      uniform float uHeadSegmentStart;
      uniform float uHeadSegmentProgress;
      attribute float aState;
      varying float vPathU;
      varying float vRibbonState;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      if (pathU > uHeadSegmentStart + 0.000001) {
        transformed = mix(aPreviousPosition, transformed, uHeadSegmentProgress);
      }
      vPathU = pathU;
      vRibbonState = aState;`,
    )

    shader.fragmentShader = `
      uniform float uReveal;
      uniform float uViewportTop;
      uniform float uEffectVelocity;
      uniform float uEffectDirection;
      uniform float uEffectStrength;
      uniform float uRibbonTime;
      uniform vec3 uActiveColor;
      uniform vec3 uTrailColor;
      uniform vec3 uHighlightColor;
      uniform vec3 uRestColor;
      uniform vec3 uMemoryColor;
      varying float vPathU;
      varying float vRibbonState;
    ${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float distanceFromHead = max(0.0, uReveal - vPathU);
      float activeBand = 1.0 - smoothstep(0.025, 0.14, distanceFromHead);
      vec3 ribbonColor = mix(uTrailColor, uActiveColor, activeBand);

      float restAmount = 1.0 - smoothstep(0.0, 0.48, abs(vRibbonState - 1.0));
      float memoryAmount = smoothstep(1.45, 1.95, vRibbonState);
      ribbonColor = mix(ribbonColor, uRestColor, restAmount * 0.34);
      ribbonColor = mix(ribbonColor, uMemoryColor, memoryAmount * 0.42);

      float pulseOffset = mix(0.009, 0.023, uEffectStrength);
      pulseOffset *= uEffectDirection < 0.0 ? 0.72 : 1.0;
      float pulseDistance = abs(vPathU - (uReveal - pulseOffset));
      float pulseWidth = mix(0.008, 0.018, uEffectStrength);
      float pulse = 1.0 - smoothstep(0.0, pulseWidth, pulseDistance);
      pulse *= uEffectStrength;
      pulse *= 0.92 + sin(uRibbonTime * 7.0) * 0.08 * uEffectStrength;

      // Referencing the canonical viewport/velocity uniforms here keeps the
      // material interface explicit without feeding them into geometry.
      float positionalInvariant = 1.0 + min(abs(uViewportTop), 1.0) * 0.0
        + min(abs(uEffectVelocity), 1.0) * 0.0;
      diffuseColor.rgb = mix(ribbonColor, uHighlightColor, pulse * 0.35) * positionalInvariant;`,
    )
    shaderRef.current = shader
  }, [palette, timeline?.initialReveal])

  const programCacheKey = useCallback(() => 'gym-scroll-drawn-ribbon-v5', [])

  useEffect(() => {
    const scene = sync.sceneRef.current
    readyRef.current = false
    if (scene) {
      scene.classList.remove('is-ready')
      scene.setAttribute('data-ribbon-ready', 'false')
      if (import.meta.env.DEV) {
        scene.setAttribute('data-ribbon-layout-epoch', String(sync.snapshot?.layoutEpoch ?? 0))
        scene.setAttribute('data-ribbon-geometry-version', geometry.uuid)
        scene.setAttribute('data-ribbon-centerline-checksum', geometry.userData.centerlineChecksum ?? '')
        scene.setAttribute('data-ribbon-bootstrap-reason', sync.snapshot?.bootstrapReason ?? '')
        scene.setAttribute('data-ribbon-data-anchor-checksum', sync.snapshot?.dataAnchorChecksum ?? '')
        scene.setAttribute(
          'data-ribbon-hero-turning-angle',
          (geometry.userData.heroMetrics?.totalTurningAngle ?? 0).toFixed(5),
        )
        scene.setAttribute(
          'data-ribbon-hero-lateral-span',
          (geometry.userData.heroMetrics?.lateralSpan ?? 0).toFixed(5),
        )
        scene.setAttribute(
          'data-ribbon-hero-reversals',
          String(geometry.userData.heroMetrics?.reversals ?? 0),
        )
        scene.setAttribute(
          'data-ribbon-hero-min-projected-width-ratio',
          (geometry.userData.heroMetrics?.minProjectedWidthRatio ?? 1).toFixed(5),
        )
      }
    }
    const release = sync.setFrameRequester(invalidate)
    return () => {
      release()
      geometry.dispose()
    }
  }, [geometry, invalidate, sync.sceneRef, sync.setFrameRequester, sync.snapshot])

  useFrame((_, delta) => {
    const snapshot = sync.stateRef.current
    const scrollY = snapshot.rawScroll
    const now = performance.now()
    const scrollReveal = getRibbonReveal(snapshot, layout, timeline)
    const heroEnd = timeline?.chapterRanges?.hero?.end ?? timeline?.initialReveal ?? .02

    if (introRef.current.eligible === null) {
      const navigationEntry = performance.getEntriesByType?.('navigation')?.[0]
      introRef.current.eligible = shouldRunHeroIntro({
        reducedMotion: reduced,
        rawScroll: scrollY,
        hash: window.location.hash,
        navigationType: navigationEntry?.type,
      })
      introRef.current.startedAt = now
    }

    const intro = getHeroIntroReveal({
      elapsedMs: now - introRef.current.startedAt,
      initialReveal: timeline?.initialReveal ?? .02,
      heroEnd,
      scrollReveal,
      eligible: introRef.current.eligible,
    })
    const reveal = reduced ? Math.max(scrollReveal, heroEnd) : intro.reveal
    const revealState = getRibbonRevealState(
      reveal,
      geometry.userData.segments,
      geometry.userData.widthSegments,
    )
    const targetVelocity = reduced ? 0 : getEffectTarget(snapshot, now)
    effectRef.current = stepEffectChannel(effectRef.current, targetVelocity, delta)
    timeRef.current += delta
    geometry.userData.curve?.getPointAt(reveal, headPointRef.current)
    if (geometry.drawRange.count !== revealState.drawCount) {
      geometry.setDrawRange(0, revealState.drawCount)
    }

    // One visual clock: DOM compensation, page-space projection and uniforms
    // all consume the same exact native-scroll snapshot in this frame.
    if (sync.sceneRef.current) {
      sync.sceneRef.current.style.transform = `translate3d(0, ${scrollY}px, 0)`
    }
    if (groupRef.current) {
      groupRef.current.position.y = (scrollY / layout.viewportHeight) * RIBBON_WORLD_HEIGHT
    }

    const shader = shaderRef.current
    if (shader) {
      shader.uniforms.uReveal.value = reveal
      shader.uniforms.uHeadSegmentStart.value = revealState.headStartU
      shader.uniforms.uHeadSegmentProgress.value = revealState.headProgress
      shader.uniforms.uViewportTop.value = scrollY - layout.viewportHeight * .25
      shader.uniforms.uEffectVelocity.value = effectRef.current.velocity
      shader.uniforms.uEffectDirection.value = effectRef.current.direction
      shader.uniforms.uEffectStrength.value = effectRef.current.strength
      shader.uniforms.uRibbonTime.value = timeRef.current
      shader.uniforms.uActiveColor.value.copy(palette.active)
      shader.uniforms.uTrailColor.value.copy(palette.trail)
      shader.uniforms.uHighlightColor.value.copy(palette.highlight)
      shader.uniforms.uRestColor.value.copy(palette.rest)
      shader.uniforms.uMemoryColor.value.copy(palette.memory)
    }

    sync.sceneRef.current?.setAttribute('data-ribbon-reveal', reveal.toFixed(5))
    sync.sceneRef.current?.setAttribute('data-ribbon-intro-progress', intro.progress.toFixed(3))
    sync.sceneRef.current?.setAttribute('data-ribbon-intro-active', String(intro.active))
    sync.sceneRef.current?.setAttribute('data-ribbon-effect-velocity', effectRef.current.velocity.toFixed(2))
    sync.sceneRef.current?.setAttribute('data-ribbon-effect-direction', String(effectRef.current.direction))
    if (geometry.userData.curve && sync.sceneRef.current) {
      const headPageY = (
        (RIBBON_WORLD_HEIGHT * .5 - headPointRef.current.y)
        / RIBBON_WORLD_HEIGHT
      ) * layout.viewportHeight
      const worldWidth = RIBBON_WORLD_HEIGHT * (layout.viewportWidth / layout.viewportHeight)
      const headX = (headPointRef.current.x / worldWidth + .5) * layout.viewportWidth
      sync.sceneRef.current.setAttribute('data-ribbon-head-y', (headPageY - scrollY).toFixed(2))
      sync.sceneRef.current.setAttribute('data-ribbon-head-x', headX.toFixed(2))
    }

    if (!readyRef.current && sync.sceneRef.current) {
      readyRef.current = true
      if (sync.snapshotRef.current) sync.snapshotRef.current.ready = true
      sync.sceneRef.current.setAttribute('data-ribbon-ready', 'true')
      sync.sceneRef.current.classList.add('is-ready')
    }

    if (intro.active || !effectRef.current.idle || now - snapshot.lastInputTime <= 32) invalidate()
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} frustumCulled={false}>
        <meshStandardMaterial
          color="#ffffff"
          side={FrontSide}
          roughness={dark ? .6 : .64}
          metalness={dark ? .035 : .015}
          onBeforeCompile={configureMaterial}
          customProgramCacheKey={programCacheKey}
        />
      </mesh>
    </group>
  )
}

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

export default function MotionSpineScene({ rootRef }) {
  const reduced = Boolean(useReducedMotion())
  const { isDark } = useTheme()
  const sceneRef = useRef(null)
  const sync = useRibbonScrollSync({ rootRef, sceneRef })
  const snapshot = sync.snapshot
  const profile = snapshot?.layout?.profile

  return (
    <div className={`trace-scene${reduced ? ' is-static' : ''}`} ref={sceneRef} aria-hidden>
      <SceneBoundary>
        {snapshot?.layout && snapshot.geometry && snapshot.timeline && profile && (
          <Canvas
            dpr={snapshot.layout.renderDpr}
            camera={{ position: [0, 0, getCameraDistance(profile)], fov: 42 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            frameloop="demand"
          >
            <ambientLight intensity={isDark ? .72 : 1.18} />
            <directionalLight position={[-4, 5, 7]} intensity={isDark ? 2.35 : 3.1} color={isDark ? '#a7bcff' : '#ffffff'} />
            <directionalLight position={[5, -3, 4]} intensity={isDark ? 1.65 : 1.35} color={isDark ? '#1457f7' : '#8eb0ff'} />
            <SpatialRibbon
              dark={isDark}
              layout={snapshot.layout}
              geometry={snapshot.geometry}
              timeline={snapshot.timeline}
              reduced={reduced}
              sync={sync}
            />
          </Canvas>
        )}
      </SceneBoundary>
    </div>
  )
}
