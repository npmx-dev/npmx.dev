import { describe, expect, it } from 'vitest'

/**
 * Tests for the pagination total capping logic used in search.vue.
 *
 * The search page caps the displayed pagination total to EAGER_LOAD_SIZE
 * so that page links only reflect pages that can actually be fetched.
 * Without the cap, a search returning total=92,000 items would show 3,680
 * pages at 25 items/page, but navigation beyond page 20 silently fails.
 */

const EAGER_LOAD_SIZE = { algolia: 500, npm: 500 } as const

function paginationTotal(effectiveTotal: number, provider: keyof typeof EAGER_LOAD_SIZE): number {
  const cap = EAGER_LOAD_SIZE[provider]
  return Math.min(effectiveTotal, cap)
}

describe('paginationTotal capping logic', () => {
  it('returns the total as-is when it is below the cap', () => {
    expect(paginationTotal(100, 'npm')).toBe(100)
    expect(paginationTotal(100, 'algolia')).toBe(100)
  })

  it('returns the cap when the total exceeds it', () => {
    expect(paginationTotal(92_000, 'npm')).toBe(500)
    expect(paginationTotal(92_000, 'algolia')).toBe(500)
  })

  it('returns exactly the cap when the total equals the cap', () => {
    expect(paginationTotal(500, 'npm')).toBe(500)
    expect(paginationTotal(500, 'algolia')).toBe(500)
  })

  it('returns 0 when total is 0', () => {
    expect(paginationTotal(0, 'npm')).toBe(0)
  })

  it('caps algolia and npm identically (both have 500 limit)', () => {
    const total = 10_000
    expect(paginationTotal(total, 'algolia')).toBe(paginationTotal(total, 'npm'))
  })

  it('page count derived from capped total stays within fetchable range', () => {
    const pageSize = 25
    const rawTotal = 92_000
    const cappedTotal = paginationTotal(rawTotal, 'npm')
    const maxPages = Math.ceil(cappedTotal / pageSize)
    // Should be 20 pages (500 / 25), not 3680 (92000 / 25)
    expect(maxPages).toBe(20)
  })
})
