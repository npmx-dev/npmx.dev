import { describe, expect, it } from 'vitest'
import {
  differenceInUtcDaysInclusive,
  mergeDailyPoints,
  splitIsoRangeIntoChunksInclusive,
} from '#shared/utils/download-ranges'

describe('differenceInUtcDaysInclusive', () => {
  it('returns 1 for the same start and end date', () => {
    expect(differenceInUtcDaysInclusive('2026-05-31', '2026-05-31')).toBe(1)
  })

  it('counts both start and end dates inclusively', () => {
    expect(differenceInUtcDaysInclusive('2026-05-01', '2026-05-31')).toBe(31)
  })

  it('handles ranges across month and year boundaries', () => {
    expect(differenceInUtcDaysInclusive('2025-12-31', '2026-01-02')).toBe(3)
  })
})

describe('splitIsoRangeIntoChunksInclusive', () => {
  it('returns a single chunk when total days is below the maximum', () => {
    expect(splitIsoRangeIntoChunksInclusive('2026-05-01', '2026-05-10', 20)).toEqual([
      {
        startIso: '2026-05-01',
        endIso: '2026-05-10',
      },
    ])
  })

  it('returns a single chunk when total days equals the maximum', () => {
    expect(splitIsoRangeIntoChunksInclusive('2026-05-01', '2026-05-10', 10)).toEqual([
      {
        startIso: '2026-05-01',
        endIso: '2026-05-10',
      },
    ])
  })

  it('splits a range into inclusive chunks', () => {
    expect(splitIsoRangeIntoChunksInclusive('2026-05-01', '2026-05-10', 4)).toEqual([
      {
        startIso: '2026-05-01',
        endIso: '2026-05-04',
      },
      {
        startIso: '2026-05-05',
        endIso: '2026-05-08',
      },
      {
        startIso: '2026-05-09',
        endIso: '2026-05-10',
      },
    ])
  })

  it('splits ranges across month boundaries', () => {
    expect(splitIsoRangeIntoChunksInclusive('2026-01-30', '2026-02-03', 2)).toEqual([
      {
        startIso: '2026-01-30',
        endIso: '2026-01-31',
      },
      {
        startIso: '2026-02-01',
        endIso: '2026-02-02',
      },
      {
        startIso: '2026-02-03',
        endIso: '2026-02-03',
      },
    ])
  })

  it('splits ranges across year boundaries', () => {
    expect(splitIsoRangeIntoChunksInclusive('2025-12-30', '2026-01-02', 2)).toEqual([
      {
        startIso: '2025-12-30',
        endIso: '2025-12-31',
      },
      {
        startIso: '2026-01-01',
        endIso: '2026-01-02',
      },
    ])
  })
})

describe('mergeDailyPoints', () => {
  it('returns an empty array when there are no points', () => {
    expect(mergeDailyPoints([])).toEqual([])
  })

  it('sorts points by day', () => {
    expect(
      mergeDailyPoints([
        { day: '2026-05-03', value: 30 },
        { day: '2026-05-01', value: 10 },
        { day: '2026-05-02', value: 20 },
      ]),
    ).toEqual([
      { day: '2026-05-01', value: 10 },
      { day: '2026-05-02', value: 20 },
      { day: '2026-05-03', value: 30 },
    ])
  })

  it('merges duplicate days by summing their values', () => {
    expect(
      mergeDailyPoints([
        { day: '2026-05-02', value: 20 },
        { day: '2026-05-01', value: 10 },
        { day: '2026-05-02', value: 5 },
        { day: '2026-05-01', value: 15 },
      ]),
    ).toEqual([
      { day: '2026-05-01', value: 25 },
      { day: '2026-05-02', value: 25 },
    ])
  })

  it('preserves negative and zero values when merging', () => {
    expect(
      mergeDailyPoints([
        { day: '2026-05-01', value: 10 },
        { day: '2026-05-01', value: -5 },
        { day: '2026-05-02', value: 0 },
      ]),
    ).toEqual([
      { day: '2026-05-01', value: 5 },
      { day: '2026-05-02', value: 0 },
    ])
  })
})
