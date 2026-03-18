import { describe, expect, it } from 'vitest'
import { areUrlsEquivalent, normalizeUrlForComparison } from '#shared/utils/url'

describe('normalizeUrlForComparison', () => {
  it('removes http protocol', () => {
    expect(normalizeUrlForComparison('http://github.com/foo')).toBe('github.com/foo')
  })

  it('removes https protocol', () => {
    expect(normalizeUrlForComparison('https://github.com/foo')).toBe('github.com/foo')
  })

  it('removes www prefix', () => {
    expect(normalizeUrlForComparison('https://www.example.com/foo')).toBe('example.com/foo')
  })

  it('removes trailing slashes', () => {
    expect(normalizeUrlForComparison('https://github.com/foo/')).toBe('github.com/foo')
  })

  it('removes hash fragments', () => {
    expect(normalizeUrlForComparison('https://github.com/foo#readme')).toBe('github.com/foo')
  })

  it('removes /tree/head path', () => {
    expect(normalizeUrlForComparison('https://github.com/foo/bar/tree/head')).toBe(
      'github.com/foo/bar',
    )
  })

  it('removes /tree/main path', () => {
    expect(normalizeUrlForComparison('https://github.com/foo/bar/tree/main')).toBe(
      'github.com/foo/bar',
    )
  })

  it('removes /tree/master path', () => {
    expect(normalizeUrlForComparison('https://github.com/foo/bar/tree/master')).toBe(
      'github.com/foo/bar',
    )
  })

  it('removes /tree/HEAD/ with trailing content', () => {
    expect(normalizeUrlForComparison('https://github.com/foo/bar/tree/HEAD/packages/core')).toBe(
      'github.com/foo/bar/packages/core',
    )
  })

  it('lowercases the URL', () => {
    expect(normalizeUrlForComparison('https://GitHub.com/Foo/Bar')).toBe('github.com/foo/bar')
  })
})

describe('areUrlsEquivalent', () => {
  it('returns true for identical URLs', () => {
    expect(areUrlsEquivalent('https://github.com/foo', 'https://github.com/foo')).toBe(true)
  })

  it('returns true for URLs with different protocols', () => {
    expect(areUrlsEquivalent('http://github.com/foo', 'https://github.com/foo')).toBe(true)
  })

  it('returns true for URLs with/without www', () => {
    expect(areUrlsEquivalent('https://www.example.com', 'https://example.com')).toBe(true)
  })

  it('returns true for URLs with/without trailing slash', () => {
    expect(areUrlsEquivalent('https://github.com/foo/', 'https://github.com/foo')).toBe(true)
  })

  it('returns true for repo URL vs homepage with tree/HEAD', () => {
    expect(
      areUrlsEquivalent(
        'https://github.com/nuxt/nuxt/tree/HEAD/packages/nuxt',
        'https://github.com/nuxt/nuxt/packages/nuxt',
      ),
    ).toBe(true)
  })

  it('returns true for repo URL vs homepage with tree/main', () => {
    expect(
      areUrlsEquivalent('https://github.com/foo/bar', 'https://github.com/foo/bar/tree/main'),
    ).toBe(true)
  })

  it('returns false for different repos', () => {
    expect(areUrlsEquivalent('https://github.com/foo/bar', 'https://github.com/foo/baz')).toBe(
      false,
    )
  })

  it('returns false for different domains', () => {
    expect(areUrlsEquivalent('https://github.com/foo', 'https://gitlab.com/foo')).toBe(false)
  })

  it('returns false for repo URL vs separate homepage', () => {
    expect(areUrlsEquivalent('https://github.com/nuxt/nuxt', 'https://nuxt.com')).toBe(false)
  })
})
