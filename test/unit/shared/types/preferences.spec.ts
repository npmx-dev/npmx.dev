import { describe, expect, it } from 'vitest'
import {
  buildSortOption,
  parseDownloadRange,
  parseSearchScope,
  parseSecurityFilter,
  parseSortOption,
  parseUpdatedWithin,
  toggleDirection,
  type SortDirection,
  type SortKey,
  type SortOption,
} from '#shared/types/preferences'

describe('parseSortOption', () => {
  it.each<[SortOption, SortKey, SortDirection]>([
    ['downloads-week-desc', 'downloads-week', 'desc'],
    ['downloads-week-asc', 'downloads-week', 'asc'],
    ['updated-desc', 'updated', 'desc'],
    ['updated-asc', 'updated', 'asc'],
    ['name-asc', 'name', 'asc'],
    ['name-desc', 'name', 'desc'],
    ['relevance-desc', 'relevance', 'desc'],
    ['relevance-asc', 'relevance', 'asc'],
  ])('parses "%s" to key="%s" direction="%s"', (option, expectedKey, expectedDirection) => {
    const result = parseSortOption(option)
    expect(result.key).toBe(expectedKey)
    expect(result.direction).toBe(expectedDirection)
  })

  it('handles multi-part keys like downloads-week', () => {
    const result = parseSortOption('downloads-week-desc')
    expect(result.key).toBe('downloads-week')
    expect(result.direction).toBe('desc')
  })

  it('handles downloads-month key', () => {
    const result = parseSortOption('downloads-month-asc')
    expect(result.key).toBe('downloads-month')
    expect(result.direction).toBe('asc')
  })
})

describe('buildSortOption', () => {
  it.each<[SortKey, SortDirection, SortOption]>([
    ['downloads-week', 'desc', 'downloads-week-desc'],
    ['downloads-week', 'asc', 'downloads-week-asc'],
    ['updated', 'desc', 'updated-desc'],
    ['name', 'asc', 'name-asc'],
    ['relevance', 'desc', 'relevance-desc'],
  ])('builds "%s" + "%s" to "%s"', (key, direction, expected) => {
    expect(buildSortOption(key, direction)).toBe(expected)
  })
})

describe('toggleDirection', () => {
  it('toggles asc to desc', () => {
    expect(toggleDirection('asc')).toBe('desc')
  })

  it('toggles desc to asc', () => {
    expect(toggleDirection('desc')).toBe('asc')
  })
})

describe('parseSearchScope', () => {
  it.each(['name', 'description', 'keywords', 'all'] as const)('accepts "%s"', value => {
    expect(parseSearchScope(value)).toBe(value)
  })

  it.each(['', 'banana', 'NAME'])('rejects "%s"', value => {
    expect(parseSearchScope(value)).toBeUndefined()
  })
})

describe('parseDownloadRange', () => {
  it.each(['any', 'lt100', '100-1k', '1k-10k', '10k-100k', 'gt100k'] as const)(
    'accepts "%s"',
    value => {
      expect(parseDownloadRange(value)).toBe(value)
    },
  )

  it.each(['', 'banana', 'gt1000'])('rejects "%s"', value => {
    expect(parseDownloadRange(value)).toBeUndefined()
  })
})

describe('parseSecurityFilter', () => {
  it.each(['all', 'secure', 'warnings'] as const)('accepts "%s"', value => {
    expect(parseSecurityFilter(value)).toBe(value)
  })

  it.each(['', 'banana', 'insecure'])('rejects "%s"', value => {
    expect(parseSecurityFilter(value)).toBeUndefined()
  })
})

describe('parseUpdatedWithin', () => {
  it.each(['any', 'week', 'month', 'quarter', 'year'] as const)('accepts "%s"', value => {
    expect(parseUpdatedWithin(value)).toBe(value)
  })

  it.each(['', 'banana', 'day'])('rejects "%s"', value => {
    expect(parseUpdatedWithin(value)).toBeUndefined()
  })
})

describe('parseSortOption and buildSortOption roundtrip', () => {
  it.each<SortOption>([
    'downloads-week-desc',
    'downloads-week-asc',
    'downloads-day-desc',
    'downloads-month-asc',
    'updated-desc',
    'name-asc',
    'relevance-desc',
    'relevance-asc',
  ])('roundtrips "%s" correctly', option => {
    const { key, direction } = parseSortOption(option)
    expect(buildSortOption(key, direction)).toBe(option)
  })
})
