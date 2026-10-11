import { describe, expect, it } from 'vitest'
import { toCacheKey } from '#server/utils/cache-key'

/** Mirrors `escapeKey` from `nitropack/dist/runtime/internal/cache.mjs`. */
function nitroEscapeKey(key: string): string {
  return String(key).replace(/\W/g, '')
}

describe('toCacheKey', () => {
  it('only produces word characters, so Nitro leaves the key untouched', () => {
    const key = toCacheKey('readme:v10:@scope/pkg_name/v/1.0.0-beta.1+build')
    expect(key).toMatch(/^\w+$/)
    expect(nitroEscapeKey(key)).toBe(key)
  })

  it.each([
    ['esbuild/v/0.1.10', 'esbuild/v/0.11.0'],
    ['webpack/v/1.1.10', 'webpack/v/1.11.0'],
    ['rollup/v/3.3.0-0', 'rollup/v/3.30.0'],
    ['foo-bar', 'foobar'],
    ['@scope/pkg', 'scope/pkg'],
  ])('keeps %s and %s distinct after Nitro escaping', (a, b) => {
    expect(nitroEscapeKey(a)).toBe(nitroEscapeKey(b))
    expect(nitroEscapeKey(toCacheKey(a))).not.toBe(nitroEscapeKey(toCacheKey(b)))
  })

  it('escapes underscores so they cannot be confused with encoded characters', () => {
    expect(toCacheKey('foo_2dbar')).not.toBe(toCacheKey('foo-bar'))
    expect(toCacheKey('foo_bar')).toBe('foo_5fbar')
  })

  it('encodes non-ASCII characters byte by byte', () => {
    expect(toCacheKey('é')).toBe('_c3_a9')
    expect(toCacheKey('ü')).not.toBe(toCacheKey('u'))
  })

  it('keeps ASCII letters and digits as is', () => {
    expect(toCacheKey('esbuild/v/0.1.10')).toBe('esbuild_2fv_2f0_2e1_2e10')
  })
})
