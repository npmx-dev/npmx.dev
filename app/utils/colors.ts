// Vue Data UI does not support CSS vars nor OKLCH for now

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
 * @public
 */
export function lightenHex(hex: string, factor: number = 0.5): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  // Lighten by mixing with white (255, 255, 255)
  const lightened = rgb.map(c => Math.round(c + (255 - c) * factor)) as [number, number, number]
  return rgbToHex(...lightened)
}

/** @public */
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
