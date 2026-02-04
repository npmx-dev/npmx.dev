import { describe, expect, it } from 'vitest'
import {
  decodeHtmlEntities,
  formatBytes,
  formatCompactNumber,
  toIsoDateString,
} from '../../../../app/utils/formatters'

describe('toIsoDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toIsoDateString(new Date('2024-03-15T00:00:00Z'))).toBe('2024-03-15')
  })

  it('pads single-digit month and day', () => {
    expect(toIsoDateString(new Date('2024-01-05T00:00:00Z'))).toBe('2024-01-05')
  })
})

describe('decodeHtmlEntities', () => {
  it.each([
    ['&amp;', '&'],
    ['&lt;', '<'],
    ['&gt;', '>'],
    ['&quot;', '"'],
    ['&#39;', "'"],
    ['&apos;', "'"],
    ['&nbsp;', ' '],
  ] as const)('%s → %s', (input, expected) => {
    expect(decodeHtmlEntities(input)).toBe(expected)
  })

  it('decodes multiple entities in one string', () => {
    expect(decodeHtmlEntities('a &amp; b &lt; c')).toBe('a & b < c')
  })

  it('leaves plain text unchanged', () => {
    expect(decodeHtmlEntities('say no to bloat')).toBe('say no to bloat')
  })

  it('leaves unknown entities unchanged', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;')
  })
})

describe('formatCompactNumber', () => {
  describe('without options', () => {
    it.each([
      [0, '0'],
      [1, '1'],
      [999, '999'],
      [1000, '1k'],
      [1500, '2k'],
      [10000, '10k'],
      [1000000, '1M'],
      [2500000, '3M'],
      [1000000000, '1B'],
      [1000000000000, '1T'],
    ] as const)('%d → %s', (input, expected) => {
      expect(formatCompactNumber(input)).toBe(expected)
    })
  })

  describe('with decimals', () => {
    it.each([
      [1500, 1, '1.5k'],
      [1234567, 2, '1.23M'],
      [1200000, 1, '1.2M'],
      [1000, 2, '1k'],
    ] as const)('%d with %d decimals', (input, decimals, expected) => {
      expect(formatCompactNumber(input, { decimals })).toBe(expected)
    })
  })

  describe('with space', () => {
    it('adds space before suffix', () => {
      expect(formatCompactNumber(1500, { space: true })).toBe('2 k')
    })
  })

  describe('negative values', () => {
    it.each([
      [-1000, '-1k'],
      [-2500000, '-3M'],
      [-42, '-42'],
    ] as const)('%d → %s', (input, expected) => {
      expect(formatCompactNumber(input)).toBe(expected)
    })
  })

  it('handles values below 1000', () => {
    expect(formatCompactNumber(500)).toBe('500')
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1023, '1023 B'],
    [1024, '1.0 kB'],
    [1536, '1.5 kB'],
    [1048576, '1.0 MB'],
    [1572864, '1.5 MB'],
  ] as const)('%d → %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected)
  })
})
