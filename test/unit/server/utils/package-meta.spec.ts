import { describe, expect, it } from 'vitest'
import { getPackageMetaCacheKey, shouldIncludeRepositoryStars } from '#server/utils/package-meta'

describe('shouldIncludeRepositoryStars', () => {
  it('requires an explicit truthy repository-stars opt-in', () => {
    expect(shouldIncludeRepositoryStars({})).toBe(false)
    expect(shouldIncludeRepositoryStars({ includeRepositoryStars: 'false' })).toBe(false)
    expect(shouldIncludeRepositoryStars({ includeRepositoryStars: '0' })).toBe(false)
    expect(shouldIncludeRepositoryStars({ includeRepositoryStars: true })).toBe(false)
    expect(shouldIncludeRepositoryStars({ includeRepositoryStars: 'true' })).toBe(true)
    expect(shouldIncludeRepositoryStars({ includeRepositoryStars: '1' })).toBe(true)
  })
})

describe('getPackageMetaCacheKey', () => {
  it('partitions cached responses by package name', () => {
    expect(getPackageMetaCacheKey('vue', false)).not.toBe(getPackageMetaCacheKey('nuxt', false))
  })

  it('partitions cached responses by `includeRepositoryStars`', () => {
    expect(getPackageMetaCacheKey('@scope/pkg', false)).not.toBe(
      getPackageMetaCacheKey('@scope/pkg', true),
    )
  })

  it('keeps cache keys stable for the same inputs', () => {
    expect(getPackageMetaCacheKey('@scope/pkg', true)).toBe(
      getPackageMetaCacheKey('@scope/pkg', true),
    )
  })
})
