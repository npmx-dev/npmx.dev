import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EvolutionOptions } from '~/types/chart'
import {
  buildDailyEvolution,
  buildMonthlyEvolution,
  buildWeeklyEvolution,
  buildYearlyEvolution,
} from '~/utils/chart-data-buckets'
import { fetchDownloadsEvolution } from '#server/utils/download-evolution'

vi.mock('~/utils/chart-data-buckets', () => ({
  buildDailyEvolution: vi.fn(),
  buildMonthlyEvolution: vi.fn(),
  buildWeeklyEvolution: vi.fn(),
  buildYearlyEvolution: vi.fn(),
}))

const buildDailyEvolutionMock = vi.mocked(buildDailyEvolution)
const buildMonthlyEvolutionMock = vi.mocked(buildMonthlyEvolution)
const buildWeeklyEvolutionMock = vi.mocked(buildWeeklyEvolution)
const buildYearlyEvolutionMock = vi.mocked(buildYearlyEvolution)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))

  vi.stubGlobal(
    '$fetch',
    vi.fn(async () => ({
      downloads: [
        { day: '2026-05-30', downloads: 30 },
        { day: '2026-05-29', downloads: 20 },
        { day: '2026-05-31', downloads: 40 },
      ],
    })),
  )

  buildDailyEvolutionMock.mockReturnValue('daily-result' as never)
  buildWeeklyEvolutionMock.mockReturnValue('weekly-result' as never)
  buildMonthlyEvolutionMock.mockReturnValue('monthly-result' as never)
  buildYearlyEvolutionMock.mockReturnValue('yearly-result' as never)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('fetchDownloadsEvolution', () => {
  it('fetches the last 30 days by default and builds daily evolution', async () => {
    const result = await fetchDownloadsEvolution('vue', {
      granularity: 'day',
    } as EvolutionOptions)

    expect(result).toBe('daily-result')
    expect($fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2026-05-02:2026-05-31/vue',
    )
    expect(buildDailyEvolutionMock).toHaveBeenCalledWith([
      { day: '2026-05-29', value: 20 },
      { day: '2026-05-30', value: 30 },
      { day: '2026-05-31', value: 40 },
    ])
  })

  it('uses explicit startDate and endDate when provided', async () => {
    const result = await fetchDownloadsEvolution('@scope/pkg', {
      granularity: 'week',
      startDate: '2026-01-01T10:30:00.000Z',
      endDate: '2026-01-31T18:45:00.000Z',
    } as EvolutionOptions)

    expect(result).toBe('weekly-result')
    expect($fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2026-01-01:2026-01-31/%40scope%2Fpkg',
    )
    expect(buildWeeklyEvolutionMock).toHaveBeenCalledWith(
      [
        { day: '2026-05-29', value: 20 },
        { day: '2026-05-30', value: 30 },
        { day: '2026-05-31', value: 40 },
      ],
      '2026-01-01',
      '2026-01-31',
    )
  })

  it('builds monthly evolution from the configured month window', async () => {
    const result = await fetchDownloadsEvolution('nuxt', {
      granularity: 'month',
      months: 3,
    } as EvolutionOptions)

    expect(result).toBe('monthly-result')
    expect($fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2026-03-01:2026-05-31/nuxt',
    )
    expect(buildMonthlyEvolutionMock).toHaveBeenCalledWith(
      expect.any(Array),
      '2026-03-01',
      '2026-05-31',
    )
  })

  it('builds yearly evolution from the package creation year', async () => {
    const result = await fetchDownloadsEvolution(
      'react',
      {
        granularity: 'year',
      } as EvolutionOptions,
      '2013-05-29T00:00:00.000Z',
    )

    expect(result).toBe('yearly-result')
    expect($fetch).toHaveBeenCalledTimes(10)
    expect($fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.npmjs.org/downloads/range/2013-01-01:2014-06-24/react',
    )
    expect($fetch).toHaveBeenNthCalledWith(
      10,
      'https://api.npmjs.org/downloads/range/2026-04-23:2026-05-31/react',
    )
    expect(buildYearlyEvolutionMock).toHaveBeenCalledWith(
      expect.any(Array),
      '2013-01-01',
      '2026-05-31',
    )
  })

  it('splits large ranges into npm-compatible chunks and merges the results', async () => {
    await fetchDownloadsEvolution('vue', {
      granularity: 'year',
      startDate: '2024-01-01',
      endDate: '2026-05-31',
    } as EvolutionOptions)

    expect($fetch).toHaveBeenCalledTimes(2)
    expect($fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.npmjs.org/downloads/range/2024-01-01:2025-06-23/vue',
    )
    expect($fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.npmjs.org/downloads/range/2025-06-24:2026-05-31/vue',
    )
  })

  it('accepts ISO datetime strings for startDate and endDate', async () => {
    await fetchDownloadsEvolution('vue', {
      granularity: 'day',
      startDate: '2026-05-01T12:34:56.000Z',
      endDate: '2026-05-31T23:59:59.999Z',
    } as EvolutionOptions)

    expect($fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2026-05-01:2026-05-31/vue',
    )
  })

  it('falls back to the default 5-year window for yearly ranges without packageCreatedIso', async () => {
    await fetchDownloadsEvolution('react', {
      granularity: 'year',
    } as EvolutionOptions)

    expect($fetch).toHaveBeenCalledTimes(4)

    expect($fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.npmjs.org/downloads/range/2021-06-02:2022-11-23/react',
    )

    expect($fetch).toHaveBeenNthCalledWith(
      4,
      'https://api.npmjs.org/downloads/range/2025-11-08:2026-05-31/react',
    )

    expect(buildYearlyEvolutionMock).toHaveBeenCalledWith(
      expect.any(Array),
      '2021-06-02',
      '2026-05-31',
    )
  })

  it('uses a 12 month window by default for monthly evolution', async () => {
    await fetchDownloadsEvolution('nuxt', {
      granularity: 'month',
    } as EvolutionOptions)

    expect($fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2025-06-01:2026-05-31/nuxt',
    )

    expect(buildMonthlyEvolutionMock).toHaveBeenCalledWith(
      expect.any(Array),
      '2025-06-01',
      '2026-05-31',
    )
  })

  it('uses a 52 week window by default for weekly evolution', async () => {
    await fetchDownloadsEvolution('vue', {
      granularity: 'week',
    } as EvolutionOptions)

    expect(buildWeeklyEvolutionMock).toHaveBeenCalledWith(
      expect.any(Array),
      '2025-06-02',
      '2026-05-31',
    )
  })

  it('uses packageCreatedIso when resolving a yearly range without startDate', async () => {
    await fetchDownloadsEvolution(
      'react',
      {
        granularity: 'year',
        endDate: '2013-12-31',
      } as EvolutionOptions,
      '2013-05-29T00:00:00.000Z',
    )

    expect($fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2013-01-01:2013-12-31/react',
    )

    expect(buildYearlyEvolutionMock).toHaveBeenCalledWith(
      expect.any(Array),
      '2013-01-01',
      '2013-12-31',
    )
  })

  it('ignores invalid date formats', async () => {
    await fetchDownloadsEvolution('vue', {
      granularity: 'day',
      startDate: 'not-a-date',
    } as EvolutionOptions)

    expect($fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2026-05-02:2026-05-31/vue',
    )
  })

  it('uses the configured week window when granularity is week', async () => {
    const result = await fetchDownloadsEvolution('vue', {
      granularity: 'week',
      weeks: 4,
    } as EvolutionOptions)

    expect(result).toBe('weekly-result')

    expect($fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2026-05-04:2026-05-31/vue',
    )

    expect(buildWeeklyEvolutionMock).toHaveBeenCalledWith(
      expect.any(Array),
      '2026-05-04',
      '2026-05-31',
    )
  })
})
