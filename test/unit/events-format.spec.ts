import { describe, expect, it } from 'vitest'
import { formatEventDateRange, isPastEvent } from '~/utils/events/format'

describe('formatEventDateRange', () => {
  it('collapses a same-day event to one line with a time range', () => {
    const out = formatEventDateRange('2026-07-26T14:00:00Z', '2026-07-26T20:00:00Z', 'en-GB')
    expect(out).toMatch(/2026/)
    expect(out).toContain('·')
    expect(out).toContain('–')
  })

  it('shows a compact day range for a multi-day, same-month event', () => {
    const out = formatEventDateRange('2026-07-26T00:00:00Z', '2026-07-27T00:00:00Z', 'en-GB')
    // e.g. "26–27 Jul 2026" — no time range, single year/month
    expect(out).toMatch(/26.*27/)
    expect(out).not.toContain('·')
  })

  it('spans months when needed', () => {
    const out = formatEventDateRange('2026-07-30T00:00:00Z', '2026-08-02T00:00:00Z', 'en-GB')
    expect(out).toMatch(/Jul/)
    expect(out).toMatch(/Aug/)
  })

  it('falls back to a single date when there is no end', () => {
    const out = formatEventDateRange('2026-07-26T14:00:00Z', undefined, 'en-GB')
    expect(out).not.toContain('–')
  })
})

describe('isPastEvent', () => {
  const now = new Date('2026-07-31T00:00:00Z')

  it('is past when the end date is before now', () => {
    expect(
      isPastEvent({ startsAt: '2026-07-26T14:00:00Z', endsAt: '2026-07-26T20:00:00Z' }, now),
    ).toBe(true)
  })

  it('is upcoming when the start date is after now', () => {
    expect(isPastEvent({ startsAt: '2026-08-10T14:00:00Z' }, now)).toBe(false)
  })
})
