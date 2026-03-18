import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearClientCaches } from '~/composables/useCharts'

const mockLikesResponse = [
  { day: '2025-03-01', likes: 5 },
  { day: '2025-03-02', likes: 3 },
  { day: '2025-03-03', likes: 8 },
  { day: '2025-03-04', likes: 2 },
  { day: '2025-03-05', likes: 10 },
  { day: '2025-03-06', likes: 1 },
  { day: '2025-03-07', likes: 4 },
  { day: '2025-03-08', likes: 6 },
  { day: '2025-03-09', likes: 7 },
  { day: '2025-03-10', likes: 3 },
]

describe('useCharts – fetchPackageLikesEvolution', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(mockLikesResponse)
    vi.stubGlobal('$fetch', fetchSpy)

    // Clear any client-side caches between tests
    clearClientCaches()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('propagates API errors', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'))

    const { fetchPackageLikesEvolution } = useCharts()

    await expect(
      fetchPackageLikesEvolution('fail-pkg', {
        granularity: 'day',
        startDate: '2025-03-01',
        endDate: '2025-03-10',
      }),
    ).rejects.toThrow('Network error')
  })

  it('returns daily points with value field mapped from likes', async () => {
    const { fetchPackageLikesEvolution } = useCharts()

    const result = await fetchPackageLikesEvolution('vue', {
      granularity: 'day',
      startDate: '2025-03-01',
      endDate: '2025-03-10',
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('value')
    expect(result[0]).toHaveProperty('day')
    expect(result[0]).toHaveProperty('timestamp')
    expect(result[0]).not.toHaveProperty('downloads')
    expect(result[0]).not.toHaveProperty('likes')
  })

  it('uses client-side promise caching for repeated calls', async () => {
    const { fetchPackageLikesEvolution } = useCharts()

    const options = { granularity: 'day' as const, startDate: '2025-03-01', endDate: '2025-03-10' }

    await fetchPackageLikesEvolution('vue', options)
    await fetchPackageLikesEvolution('vue', options)

    // Should only fetch once thanks to client-side promise caching
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
