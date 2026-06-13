import { describe, expect, it, vi } from 'vitest'
import {
  addDays,
  DAY_MS,
  daysInMonth,
  daysInYear,
  parseIsoDate,
  toIsoDate,
  getEffectiveEndDateIso,
  isLastDayOfMonth,
  isLastDayOfYear,
} from '~/utils/date'

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

describe('getEffectiveEndDateIso', () => {
  it('returns the provided end date when present', () => {
    expect(getEffectiveEndDateIso('2026-05-31')).toBe('2026-05-31')
  })

  it('returns yesterday in UTC when no end date is provided', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))

    expect(getEffectiveEndDateIso()).toBe('2026-05-31')

    vi.useRealTimers()
  })

  it('handles UTC month boundaries', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T00:30:00.000Z'))

    expect(getEffectiveEndDateIso()).toBe('2026-02-28')

    vi.useRealTimers()
  })

  it('handles UTC year boundaries', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:30:00.000Z'))

    expect(getEffectiveEndDateIso()).toBe('2025-12-31')

    vi.useRealTimers()
  })
})

describe('isLastDayOfMonth', () => {
  it('returns true for the last day of a 31-day month', () => {
    expect(isLastDayOfMonth('2026-01-31')).toBe(true)
  })

  it('returns true for the last day of a 30-day month', () => {
    expect(isLastDayOfMonth('2026-04-30')).toBe(true)
  })

  it('returns true for February 29 in a leap year', () => {
    expect(isLastDayOfMonth('2024-02-29')).toBe(true)
  })

  it('returns true for February 28 in a non-leap year', () => {
    expect(isLastDayOfMonth('2023-02-28')).toBe(true)
  })

  it('returns false when the date is not the last day of the month', () => {
    expect(isLastDayOfMonth('2026-05-30')).toBe(false)
  })
})

describe('isLastDayOfYear', () => {
  it('returns true for December 31', () => {
    expect(isLastDayOfYear('2026-12-31')).toBe(true)
  })

  it('returns false for any other day in December', () => {
    expect(isLastDayOfYear('2026-12-30')).toBe(false)
  })

  it('returns false for the last day of a month that is not December', () => {
    expect(isLastDayOfYear('2026-11-30')).toBe(false)
  })

  it('returns true for leap years on December 31', () => {
    expect(isLastDayOfYear('2024-12-31')).toBe(true)
  })
})
