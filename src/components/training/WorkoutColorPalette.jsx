import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, Palette, Pipette, X } from 'lucide-react'
import { ColorArea, ColorThumb, parseColor } from 'react-aria-components/ColorArea'
import { ColorSlider } from 'react-aria-components/ColorSlider'
import { SliderTrack } from 'react-aria-components/Slider'
import { Popover } from 'react-aria-components/Popover'
import { Dialog } from 'react-aria-components/Dialog'
import { WORKOUT_COLORS, getWorkoutColor, serializeWorkoutColor } from '../../utils/workoutColors.js'
import './workoutColorPicker.css'

function visibleAnchor(target) {
  const rect = target.getBoundingClientRect()
  const top = window.visualViewport?.offsetTop || 0
  const height = window.visualViewport?.height || window.innerHeight
  const y = Math.max(top + 12, Math.min(rect.y, top + height - rect.height - 12))
  return new DOMRect(rect.x, y, rect.width, rect.height)
}

function QuickColors({ value, onChange, disabled = false, compact = false }) {
  const name = useId()
  return (
    <div role="group" aria-label="Cores rápidas" className={`flex flex-wrap ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {WORKOUT_COLORS.map((color) => {
        const selected = value === color.value || value === color.light.toUpperCase()
        return (
          <label key={color.value} className={`relative flex cursor-pointer items-center justify-center rounded-full ${compact ? 'h-9 w-9' : 'h-11 w-11'}`} title={color.label}>
            <input type="radio" name={name} value={color.value} checked={selected} disabled={disabled} onChange={() => onChange(color.value)} className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            <span className="sr-only">{color.label}</span>
            <span aria-hidden="true" style={{ backgroundColor: color.swatch }} className="pointer-events-none flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-white peer-checked:ring-2 peer-checked:ring-app-accent peer-checked:ring-offset-2 peer-checked:ring-offset-app-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-app-accent peer-disabled:opacity-50">
              {selected && <Check size={14} strokeWidth={3} />}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function ColorValueField({ label, value, onInput, hint, inputMode = 'text' }) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  const [invalid, setInvalid] = useState(false)
  useEffect(() => { setDraft(String(value)); setInvalid(false) }, [value])

  return (
    <label className="min-w-0 text-[11px] font-medium text-app-secondary">
      {label}
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? id : undefined}
        value={draft}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          setInvalid(next !== '' && !onInput(next))
        }}
        onBlur={() => { if (!draft) setDraft(String(value)) }}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }}
        className="mt-1 block min-h-10 w-full rounded-lg border border-app-line bg-app-muted px-2.5 text-sm tabular-nums text-app-ink outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent aria-invalid:border-app-danger"
      />
      {invalid && <span id={id} className="mt-1 block text-[10px] leading-tight text-app-danger">{hint}</span>}
    </label>
  )
}

export default memo(function WorkoutColorPalette({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const trigger = useRef(null)
  const captureController = useRef(null)
  const id = useId()
  const storedValue = serializeWorkoutColor(value)
  const current = getWorkoutColor(storedValue)
  const color = useMemo(() => typeof value === 'string' ? parseColor(getWorkoutColor(value).light).toFormat('hsb') : value, [value])
  const hex = color.toString('hex').toUpperCase()
  const rgb = color.toFormat('rgb')
  const supportsEyeDropper = typeof window !== 'undefined' && typeof window.EyeDropper === 'function'
  const changeColor = (next) => { if (next) onChange(next.toFormat('hsb')) }

  useEffect(() => () => captureController.current?.abort(), [])

  function changeOpen(next) {
    if (!next) { captureController.current?.abort(); setCapturing(false) }
    setOpen(next)
  }

  async function captureColor() {
    if (!supportsEyeDropper || capturing) return
    const controller = new AbortController()
    captureController.current = controller
    setCapturing(true)
    setCaptureError('')
    try {
      const result = await new window.EyeDropper().open({ signal: controller.signal })
      if (!controller.signal.aborted) changeColor(parseColor(result.sRGBHex))
    } catch (error) {
      if (error.name !== 'AbortError' && !controller.signal.aborted) setCaptureError('Não foi possível capturar a cor. Tente novamente.')
    } finally {
      if (!controller.signal.aborted) setCapturing(false)
    }
  }

  return (
    <fieldset disabled={disabled} className="mt-6 min-w-0">
      <legend className="text-sm font-semibold text-app-ink">Cor de destaque</legend>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs text-app-secondary">
          <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-app-control" style={{ backgroundColor: hex }} />
          {current.label}
        </span>
        <button ref={trigger} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => changeOpen(!open)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-app-line bg-app-surface px-3 text-xs font-semibold text-app-ink hover:bg-app-selection focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent disabled:opacity-50">
          <Palette size={15} aria-hidden="true" />Personalizar cor
        </button>
      </div>
      <div className="mt-2"><QuickColors value={storedValue} onChange={onChange} disabled={disabled} /></div>
      <Popover triggerRef={trigger} isOpen={open && !disabled} onOpenChange={changeOpen} placement="bottom end" offset={8} containerPadding={12} maxHeight={560} getTargetRect={visibleAnchor} shouldFlip className="workout-color-popover" onKeyDownCapture={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); changeOpen(false); trigger.current?.focus() }
      }}>
        <Dialog id={id} aria-label="Personalizar cor do treino" className="outline-none">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-app-ink">Cor do treino</h3>
            <button type="button" aria-label="Fechar seletor de cor" onClick={() => changeOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-app-secondary hover:bg-app-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"><X size={16} aria-hidden="true" /></button>
          </div>
          <div className="flex gap-3">
            <ColorArea aria-label="Saturação e luminosidade" colorSpace="hsb" xChannel="saturation" yChannel="brightness" value={color} onChange={changeColor} className="workout-color-area"><ColorThumb className="workout-color-thumb" /></ColorArea>
            <ColorSlider aria-label="Tonalidade" colorSpace="hsb" channel="hue" orientation="vertical" value={color} onChange={changeColor} className="workout-hue-slider"><SliderTrack className="workout-hue-track"><ColorThumb className="workout-color-thumb" /></SliderTrack></ColorSlider>
          </div>
          <div className="mt-4 grid grid-cols-[2rem_minmax(0,1fr)] items-end gap-3">
            <span aria-label={`Cor atual ${hex}`} className="mb-1 h-8 w-8 rounded-lg border border-app-control" style={{ backgroundColor: hex }} />
            <ColorValueField label="HEX" value={hex} hint="Use #RRGGBB." onInput={(text) => {
              const input = text.trim().replace(/^#/, '')
              if (!/^[0-9a-f]{6}$/i.test(input)) return false
              changeColor(parseColor(`#${input}`))
              return true
            }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[['red', 'R'], ['green', 'G'], ['blue', 'B']].map(([channel, label]) => <ColorValueField key={channel} label={label} value={rgb.getChannelValue(channel)} inputMode="numeric" hint="De 0 a 255." onInput={(text) => {
              if (!/^\d{1,3}$/.test(text) || Number(text) > 255) return false
              changeColor(rgb.withChannelValue(channel, Number(text)))
              return true
            }} />)}
          </div>
          <div className="mt-4 border-t border-app-line pt-3">
            <p className="mb-1 text-[11px] font-medium text-app-secondary">Cores rápidas</p>
            <QuickColors value={storedValue} onChange={onChange} compact />
          </div>
          <button type="button" disabled={!supportsEyeDropper || capturing} onClick={captureColor} title={supportsEyeDropper ? 'Capturar uma cor da tela' : 'Conta-gotas não disponível neste navegador'} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-app-line text-xs font-medium text-app-ink hover:bg-app-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent disabled:cursor-not-allowed disabled:opacity-50"><Pipette size={15} aria-hidden="true" />{capturing ? 'Capturando cor…' : 'Capturar da tela'}</button>
          {captureError && <p role="status" className="mt-2 text-xs text-app-danger">{captureError}</p>}
        </Dialog>
      </Popover>
    </fieldset>
  )
})
