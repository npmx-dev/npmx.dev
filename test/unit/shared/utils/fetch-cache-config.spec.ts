import { describe, expect, it } from 'vitest'
import {
  FETCH_CACHE_ALLOWED_DOMAINS,
  isAllowedDomain,
  resolveRequestUrl,
} from '#shared/utils/fetch-cache-config'

describe('resolveRequestUrl', () => {
  it('passes through absolute URLs', () => {
    expect(resolveRequestUrl('https://registry.npmjs.org/vite')?.href).toBe(
      'https://registry.npmjs.org/vite',
    )
  })

  it('resolves a relative path against baseURL', () => {
    expect(resolveRequestUrl('/vite', { baseURL: 'https://registry.npmjs.org' })?.href).toBe(
      'https://registry.npmjs.org/vite',
    )
  })

  it('keeps the baseURL path, matching how ofetch joins them', () => {
    expect(
      resolveRequestUrl('/point/last-week/vite', { baseURL: 'https://api.npmjs.org/downloads' })
        ?.href,
    ).toBe('https://api.npmjs.org/downloads/point/last-week/vite')
  })

  it('does not treat a protocol-relative path as a different host', () => {
    expect(
      resolveRequestUrl('//example.com/vite', { baseURL: 'https://registry.npmjs.org' })?.host,
    ).toBe('registry.npmjs.org')
  })

  it('leaves an existing query string untouched when no query options are given', () => {
    expect(
      resolveRequestUrl('/-/v1/search?text=maintainer%3Afoo&q=a%20b', {
        baseURL: 'https://registry.npmjs.org',
      })?.href,
    ).toBe('https://registry.npmjs.org/-/v1/search?text=maintainer%3Afoo&q=a%20b')
  })

  it('appends params and query options to the URL', () => {
    expect(
      resolveRequestUrl('/-/v1/search?size=25', {
        baseURL: 'https://registry.npmjs.org',
        params: { text: 'vue' },
        query: { from: 25 },
      })?.href,
    ).toBe('https://registry.npmjs.org/-/v1/search?size=25&text=vue&from=25')
  })

  it('returns null for a relative path with no baseURL', () => {
    expect(resolveRequestUrl('/vite')).toBeNull()
  })
})

describe('isAllowedDomain after resolving', () => {
  it('allows a relative registry request once resolved against baseURL', () => {
    const resolved = resolveRequestUrl('/vite', { baseURL: 'https://registry.npmjs.org' })
    expect(resolved).not.toBeNull()
    expect(isAllowedDomain(resolved!)).toBe(true)
  })

  it('includes the npm registry and rejects unknown hosts', () => {
    expect(FETCH_CACHE_ALLOWED_DOMAINS).toContain('registry.npmjs.org')
    expect(isAllowedDomain('https://example.com/foo')).toBe(false)
  })
})
