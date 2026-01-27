// Vue Data UI does not support CSS vars nor OKLCH for now
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

  let r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
  let g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
  let bRgb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_

  const toSrgb = (value: number): number =>
    value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055

  r = toSrgb(r)
  g = toSrgb(g)
  bRgb = toSrgb(bRgb)

  const toHex = (value: number): string =>
    Math.round(Math.min(Math.max(0, value), 1) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(bRgb)}`
}
