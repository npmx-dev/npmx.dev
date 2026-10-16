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
    expect(resolveRequestUrl('/vite', 'https://registry.npmjs.org')?.href).toBe(
      'https://registry.npmjs.org/vite',
    )
  })

  it('accepts a URL instance as-is', () => {
    const url = new URL('https://api.npmjs.org/downloads/point/last-week/vite')
    expect(resolveRequestUrl(url)).toBe(url)
  })

  it('returns null for a relative path with no baseURL', () => {
    expect(resolveRequestUrl('/vite')).toBeNull()
  })
})

describe('isAllowedDomain after resolving', () => {
  it('allows a relative registry request once resolved against baseURL', () => {
    const resolved = resolveRequestUrl('/vite', 'https://registry.npmjs.org')
    expect(resolved).not.toBeNull()
    expect(isAllowedDomain(resolved!)).toBe(true)
  })

  it('includes the npm registry and rejects unknown hosts', () => {
    expect(FETCH_CACHE_ALLOWED_DOMAINS).toContain('registry.npmjs.org')
    expect(isAllowedDomain('https://example.com/foo')).toBe(false)
  })
})
