import { describe, expect, it } from 'vitest'
import { toIsoDateString } from '../../../../app/utils/formatters'

describe('toIsoDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toIsoDateString(new Date('2024-03-15T00:00:00Z'))).toBe('2024-03-15')
  })

  it('pads single-digit month and day', () => {
    expect(toIsoDateString(new Date('2024-01-05T00:00:00Z'))).toBe('2024-01-05')
  })
})
