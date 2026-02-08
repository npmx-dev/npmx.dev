import { describe, expect, it } from 'vitest'
import {
  buildSortOption,
  parseSortOption,
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
    ['quality-desc', 'quality', 'desc'],
    ['score-asc', 'score', 'asc'],
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
    ['quality', 'desc', 'quality-desc'],
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

describe('parseSortOption and buildSortOption roundtrip', () => {
  it.each<SortOption>([
    'downloads-week-desc',
    'downloads-week-asc',
    'downloads-day-desc',
    'downloads-month-asc',
    'updated-desc',
    'name-asc',
    'quality-desc',
    'popularity-asc',
    'maintenance-desc',
    'score-asc',
    'relevance-desc',
    'relevance-asc',
  ])('roundtrips "%s" correctly', option => {
    const { key, direction } = parseSortOption(option)
    expect(buildSortOption(key, direction)).toBe(option)
  })
})
