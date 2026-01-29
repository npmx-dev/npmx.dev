// Vue Data UI does not support CSS vars nor OKLCH for now

/**
 * Default neutral OKLCH color used as fallback when CSS variables are unavailable (e.g., during SSR).
 * This matches the dark mode value of --fg-subtle defined in main.css.
 */
export const OKLCH_NEUTRAL_FALLBACK = 'oklch(0.633 0 0)'

/** Converts a 0-255 RGB component to a 2-digit hex string */
const componentToHex = (value: number): string =>
  Math.round(Math.min(Math.max(0, value), 255))
    .toString(16)
    .padStart(2, '0')

/** Converts a 0-1 linear value to a 2-digit hex string */
const linearToHex = (value: number): string =>
  Math.round(Math.min(Math.max(0, value), 1) * 255)
    .toString(16)
    .padStart(2, '0')

/** Converts linear RGB to sRGB gamma-corrected value */
const linearToSrgb = (value: number): number =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055

/**
 * Converts a hex color to RGB components
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1]!, 16), parseInt(result[2]!, 16), parseInt(result[3]!, 16)]
    : null
}

/**
 * Converts RGB components to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
}

/**
 * Lightens a hex color by mixing it with white.
 * Used to create light tints of accent colors for better visibility in light mode.
 * @param hex - The hex color to lighten (e.g., "#ff0000")
 * @param factor - Lighten factor from 0 to 1 (0.5 = 50% lighter, mixed with white)
 */
export function lightenHex(hex: string, factor: number = 0.5): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  // Lighten by mixing with white (255, 255, 255)
  const lightened = rgb.map(c => Math.round(c + (255 - c) * factor)) as [number, number, number]
  return rgbToHex(...lightened)
}

export function oklchToHex(color: string | undefined | null): string | undefined | null {
  if (color == null) return color

  const match = color.trim().match(/^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/i)

  if (!match) {
    throw new Error('Invalid OKLCH color format')
  }

  const lightness = Number(match[1])
  const chroma = Number(match[2])
  const hue = Number(match[3])

  const hRad = (hue * Math.PI) / 180

  const a = chroma * Math.cos(hRad)
  const b = chroma * Math.sin(hRad)

  let l_ = lightness + 0.3963377774 * a + 0.2158037573 * b
  let m_ = lightness - 0.1055613458 * a - 0.0638541728 * b
  let s_ = lightness - 0.0894841775 * a - 1.291485548 * b

  l_ = l_ ** 3
  m_ = m_ ** 3
  s_ = s_ ** 3

  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
  const bRgb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_

  return `#${linearToHex(linearToSrgb(r))}${linearToHex(linearToSrgb(g))}${linearToHex(linearToSrgb(bRgb))}`
}

/**
 * Lighten an OKLCH color by a given factor.
 *
 * Works with strict TypeScript settings including `noUncheckedIndexedAccess`,
 * where `match[n]` is typed as `string | undefined`.
 *
 * @param oklch - Color in the form "oklch(L C H)" or "oklch(L C H / A)"
 * @param factor - Lightening force in range [0, 1]
 * @returns Lightened OKLCH color string (0.5 = 50% lighter)
 */
export function lightenOklch(
  oklch: string | null | undefined,
  factor: number,
): string | null | undefined {
  if (oklch == null) {
    return oklch
  }

  const input = oklch.trim()

  const match = input.match(
    /^oklch\(\s*([+-]?[\d.]+%?)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)(?:\s*\/\s*([+-]?[\d.]+%?))?\s*\)$/i,
  )

  if (!match) {
    throw new Error('Invalid OKLCH color format')
  }

  const [, lightnessText, chromaText, hueText, alphaText] = match

  if (lightnessText === undefined || chromaText === undefined || hueText === undefined) {
    throw new Error('Invalid OKLCH color format')
  }

  let lightness = lightnessText.endsWith('%')
    ? Number.parseFloat(lightnessText) / 100
    : Number.parseFloat(lightnessText)
  let chroma = Number.parseFloat(chromaText)
  const hue = Number.parseFloat(hueText)
  const alpha =
    alphaText === undefined
      ? null
      : alphaText.endsWith('%')
        ? Number.parseFloat(alphaText) / 100
        : Number.parseFloat(alphaText)

  const clampedFactor = Math.min(Math.max(factor, 0), 1)
  lightness = lightness + (1 - lightness) * clampedFactor

  // Reduce chroma slightly as lightness increases
  chroma = chroma * (1 - clampedFactor * 0.3)

  lightness = Math.min(Math.max(lightness, 0), 1)
  chroma = Math.max(chroma, 0)

  return alpha === null
    ? `oklch(${lightness} ${chroma} ${hue})`
    : `oklch(${lightness} ${chroma} ${hue} / ${alpha})`
}

/**
 * Make an OKLCH color transparent by a given factor.
 *
 * @param oklch - Color in the form "oklch(L C H)" or "oklch(L C H / A)"
 * @param factor - Transparency factor in range [0, 1]
 * @returns OKLCH color string with adjusted alpha (0.5 = 50% transparency, 1 = fully transparent)
 */
export function transparentizeOklch(
  oklch: string | null | undefined,
  factor: number,
  fallback = 'oklch(0 0 0 / 0)',
): string {
  if (oklch == null) return fallback

  const input = oklch.trim()
  if (!input) return fallback

  const match = input.match(
    /^oklch\(\s*([+-]?[\d.]+%?)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)(?:\s*\/\s*([+-]?[\d.]+%?))?\s*\)$/i,
  )

  if (!match) return fallback

  const [, lightnessText, chromaText, hueText, alphaText] = match

  if (lightnessText === undefined || chromaText === undefined || hueText === undefined) {
    return fallback
  }

  const lightness = lightnessText.endsWith('%')
    ? Math.min(Math.max(Number.parseFloat(lightnessText) / 100, 0), 1)
    : Math.min(Math.max(Number.parseFloat(lightnessText), 0), 1)

  const chroma = Math.max(0, Number.parseFloat(chromaText))
  const hue = Number.parseFloat(hueText)

  const originalAlpha =
    alphaText === undefined
      ? 1
      : alphaText.endsWith('%')
        ? Math.min(Math.max(Number.parseFloat(alphaText) / 100, 0), 1)
        : Math.min(Math.max(Number.parseFloat(alphaText), 0), 1)

  const clampedFactor = Math.min(Math.max(factor, 0), 1)
  const alpha = Math.max(0, originalAlpha * (1 - clampedFactor))

  return `oklch(${lightness} ${chroma} ${hue} / ${alpha})`
}
