import { describe, expect, it } from 'vitest'
import {
    addDays,
    DAY_MS,
    daysInMonth,
    daysInYear,
    parseIsoDate,
    toIsoDate,
} from '../../../../app/utils/date'

describe('DAY_MS', () => {
  it('equals 86 400 000', () => {
    expect(DAY_MS).toBe(86_400_000)
  })
})

describe('parseIsoDate', () => {
  it('returns a UTC midnight date', () => {
    const d = parseIsoDate('2024-03-15')
    expect(d.toISOString()).toBe('2024-03-15T00:00:00.000Z')
  })

  it('does not shift across timezones', () => {
    const d = parseIsoDate('2024-01-01')
    expect(d.getUTCHours()).toBe(0)
    expect(d.getUTCFullYear()).toBe(2024)
  })
})

describe('toIsoDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date('2024-03-15T00:00:00.000Z'))).toBe('2024-03-15')
  })

  it('roundtrips with parseIsoDate', () => {
    const iso = '2024-12-31'
    expect(toIsoDate(parseIsoDate(iso))).toBe(iso)
  })
})

describe('addDays', () => {
  it('adds positive days', () => {
    const d = parseIsoDate('2024-03-01')
    expect(toIsoDate(addDays(d, 5))).toBe('2024-03-06')
  })

  it('subtracts with negative days', () => {
    const d = parseIsoDate('2024-03-10')
    expect(toIsoDate(addDays(d, -3))).toBe('2024-03-07')
  })

  it('crosses month boundary', () => {
    const d = parseIsoDate('2024-01-30')
    expect(toIsoDate(addDays(d, 3))).toBe('2024-02-02')
  })

  it('does not mutate the original date', () => {
    const d = parseIsoDate('2024-06-15')
    addDays(d, 10)
    expect(toIsoDate(d)).toBe('2024-06-15')
  })
})

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    expect(daysInMonth(2024, 0)).toBe(31)
  })

  it('returns 29 for Feb in a leap year', () => {
    expect(daysInMonth(2024, 1)).toBe(29)
  })

  it('returns 28 for Feb in a non-leap year', () => {
    expect(daysInMonth(2023, 1)).toBe(28)
  })

  it('returns 30 for April', () => {
    expect(daysInMonth(2024, 3)).toBe(30)
  })
})

describe('daysInYear', () => {
  it('returns 366 for a leap year', () => {
    expect(daysInYear(2024)).toBe(366)
  })

  it('returns 365 for a non-leap year', () => {
    expect(daysInYear(2023)).toBe(365)
  })

  it('returns 365 for century non-leap year', () => {
    expect(daysInYear(1900)).toBe(365)
  })

  it('returns 366 for year 2000 (divisible by 400)', () => {
    expect(daysInYear(2000)).toBe(366)
  })
})
