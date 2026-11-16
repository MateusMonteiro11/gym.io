export const DEFAULT_WORKOUT_COLOR = 'azul'

export const WORKOUT_COLORS = Object.freeze([
  { value: 'azul', label: 'Azul', light: '#1457f7', dark: '#729aff', swatch: '#527fda' },
  { value: 'ciano', label: 'Ciano', light: '#08758a', dark: '#71c7d8', swatch: '#449caf' },
  { value: 'verde', label: 'Verde', light: '#24734d', dark: '#7ac49a', swatch: '#579b74' },
  { value: 'roxo', label: 'Roxo', light: '#7550aa', dark: '#bc9ce3', swatch: '#9273bc' },
  { value: 'rosa', label: 'Rosa', light: '#a44073', dark: '#e59dbd', swatch: '#c5789c' },
  { value: 'laranja', label: 'Laranja', light: '#a4531f', dark: '#e9b080', swatch: '#c88b58' },
  { value: 'amarelo', label: 'Amarelo', light: '#80620b', dark: '#dfc578', swatch: '#c4a650' },
  { value: 'vermelho', label: 'Vermelho', light: '#b1424c', dark: '#e99da3', swatch: '#c7737c' },
])

export function isWorkoutColor(value) {
  return typeof value === 'string' && (WORKOUT_COLORS.some((color) => color.value === value) || /^#[0-9a-f]{6}$/i.test(value))
}

export function normalizeWorkoutColor(value) {
  if (!isWorkoutColor(value)) return null
  return value.startsWith('#') ? value.toUpperCase() : value
}

export function serializeWorkoutColor(value) {
  const serialized = typeof value === 'string' ? value : value?.toString('hex')
  return normalizeWorkoutColor(serialized) || DEFAULT_WORKOUT_COLOR
}

export function getWorkoutColor(value) {
  const normalized = normalizeWorkoutColor(value)
  if (normalized?.startsWith('#')) {
    return { value: normalized, label: normalized, light: normalized, dark: normalized, swatch: normalized }
  }
  return WORKOUT_COLORS.find((color) => color.value === value) || WORKOUT_COLORS[0]
}

export function isSystemWorkout(workout) {
  return workout?.tipo === 'sistema' || workout?.tipo_treino === 'sistema'
}

export function workoutColorStyle(workout) {
  if (isSystemWorkout(workout)) return undefined
  const color = getWorkoutColor(workout?.cor_destaque)
  return {
    '--workout-color-light': color.light,
    '--workout-color-dark': color.dark,
    '--workout-color-text-light': readableAccent(color.light, '#ffffff'),
    '--workout-color-text-dark': readableAccent(color.dark, '#18181b'),
  }
}

function channels(hex) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
}

function luminance(rgb) {
  return rgb.map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

function readableAccent(hex, surface) {
  const rgb = channels(hex)
  const background = rgb.map((value, index) => value * 0.09 + channels(surface)[index] * 0.91)
  const backgroundLight = luminance(background)
  const target = backgroundLight > 0.179 ? 0 : 255
  for (let step = 0; step <= 20; step += 1) {
    const adjusted = rgb.map((value) => Math.round(value + (target - value) * step / 20))
    const light = luminance(adjusted)
    if ((Math.max(light, backgroundLight) + 0.05) / (Math.min(light, backgroundLight) + 0.05) >= 4.5) {
      return `#${adjusted.map((value) => value.toString(16).padStart(2, '0')).join('')}`
    }
  }
  return target === 0 ? '#000000' : '#ffffff'
}
