import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities, toIsoDateString } from '../../../../app/utils/formatters'

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
