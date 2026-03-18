import { describe, expect, it } from 'vitest'
import { lightenHex, oklchToHex, transparentizeOklch } from '../../../../app/utils/colors'

describe('lightenHex', () => {
  it('lightens a color by the default factor (0.5)', () => {
    expect(lightenHex('#000000')).toBe('#808080')
  })

  it('lightens a color by a custom factor', () => {
    expect(lightenHex('#000000', 0.25)).toBe('#404040')
    expect(lightenHex('#000000', 0.75)).toBe('#bfbfbf')
    expect(lightenHex('#000000', 1)).toBe('#ffffff')
  })

  it('returns white when factor is 1', () => {
    expect(lightenHex('#ff0000', 1)).toBe('#ffffff')
    expect(lightenHex('#123456', 1)).toBe('#ffffff')
  })

  it('returns the original color when factor is 0', () => {
    expect(lightenHex('#ff0000', 0)).toBe('#ff0000')
    expect(lightenHex('#123456', 0)).toBe('#123456')
  })

  it('lightens each channel independently', () => {
    // #ff0000 at 0.5 -> r: 255+(0)*0.5=255, g: 0+(255)*0.5=128, b: 0+(255)*0.5=128
    expect(lightenHex('#ff0000', 0.5)).toBe('#ff8080')
  })

  it('returns the input unchanged for an invalid hex', () => {
    expect(lightenHex('not-a-color')).toBe('not-a-color')
  })

  it('handles hex without leading #', () => {
    expect(lightenHex('000000', 0.5)).toBe('#808080')
  })
})

describe('oklchToHex', () => {
  it('converts pure black', () => {
    expect(oklchToHex('oklch(0 0 0)')).toMatchInlineSnapshot(`"#000000"`)
  })

  it('converts pure white', () => {
    expect(oklchToHex('oklch(1 0 0)')).toMatchInlineSnapshot(`"#ffffff"`)
  })

  it('converts a saturated red', () => {
    expect(oklchToHex('oklch(0.628 0.258 29.23)')).toMatchInlineSnapshot(`"#ff0000"`)
  })

  it('converts a saturated green', () => {
    expect(oklchToHex('oklch(0.866 0.295 142.5)')).toMatchInlineSnapshot(`"#00ff00"`)
  })

  it('converts a saturated blue', () => {
    expect(oklchToHex('oklch(0.452 0.313 264.05)')).toMatchInlineSnapshot(`"#0000ff"`)
  })

  it('converts the neutral fallback color', () => {
    expect(oklchToHex('oklch(0.633 0 0)')).toMatchInlineSnapshot(`"#8a8a8a"`)
  })

  it('returns null for null input', () => {
    expect(oklchToHex(null)).toBeNull()
  })

  it('returns undefined for undefined input', () => {
    expect(oklchToHex(undefined)).toBeUndefined()
  })

  it('throws on invalid format', () => {
    expect(() => oklchToHex('not-a-color')).toThrow('Invalid OKLCH color format')
  })
})

describe('transparentizeOklch', () => {
  it('makes a color 50% transparent', () => {
    expect(transparentizeOklch('oklch(0.5 0.2 120)', 0.5)).toMatchInlineSnapshot(
      `"oklch(0.5 0.2 120 / 0.5)"`,
    )
  })

  it('makes a color fully transparent (factor 1)', () => {
    expect(transparentizeOklch('oklch(0.5 0.2 120)', 1)).toMatchInlineSnapshot(
      `"oklch(0.5 0.2 120 / 0)"`,
    )
  })

  it('keeps a color fully opaque (factor 0)', () => {
    expect(transparentizeOklch('oklch(0.5 0.2 120)', 0)).toMatchInlineSnapshot(
      `"oklch(0.5 0.2 120 / 1)"`,
    )
  })

  it('reduces existing alpha', () => {
    expect(transparentizeOklch('oklch(0.5 0.2 120 / 0.8)', 0.5)).toMatchInlineSnapshot(
      `"oklch(0.5 0.2 120 / 0.4)"`,
    )
  })

  it('handles percentage lightness and alpha', () => {
    expect(transparentizeOklch('oklch(50% 0.2 120 / 80%)', 0.5)).toMatchInlineSnapshot(
      `"oklch(0.5 0.2 120 / 0.4)"`,
    )
  })

  it('clamps factor to [0, 1]', () => {
    expect(transparentizeOklch('oklch(0.5 0.2 120)', 2)).toMatchInlineSnapshot(
      `"oklch(0.5 0.2 120 / 0)"`,
    )
    expect(transparentizeOklch('oklch(0.5 0.2 120)', -1)).toMatchInlineSnapshot(
      `"oklch(0.5 0.2 120 / 1)"`,
    )
  })

  it('returns fallback for null input', () => {
    expect(transparentizeOklch(null, 0.5)).toBe('oklch(0 0 0 / 0)')
  })

  it('returns fallback for undefined input', () => {
    expect(transparentizeOklch(undefined, 0.5)).toBe('oklch(0 0 0 / 0)')
  })

  it('returns fallback for empty string', () => {
    expect(transparentizeOklch('', 0.5)).toBe('oklch(0 0 0 / 0)')
  })

  it('returns fallback for invalid format', () => {
    expect(transparentizeOklch('not-a-color', 0.5)).toBe('oklch(0 0 0 / 0)')
  })

  it('uses custom fallback', () => {
    expect(transparentizeOklch(null, 0.5, 'oklch(1 0 0 / 0)')).toBe('oklch(1 0 0 / 0)')
  })
})
