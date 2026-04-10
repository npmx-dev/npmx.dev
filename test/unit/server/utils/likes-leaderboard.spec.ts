import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractPackageNameFromSubjectRef,
  normalizeLikesLeaderboardPayload,
  getLikesLeaderboard,
  getTopLikedRank,
} from '#server/utils/likes-leaderboard'

type TestEvent = Parameters<typeof getLikesLeaderboard>[0]
type TestCachedFetch = NonNullable<TestEvent['context']['cachedFetch']>

function createEvent(cachedFetch: TestCachedFetch): TestEvent {
  return {
    context: { cachedFetch },
  } as TestEvent
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractPackageNameFromSubjectRef', () => {
  it('extracts package names from package subject refs', () => {
    expect(extractPackageNameFromSubjectRef('https://npmx.dev/package/vue')).toBe('vue')
    expect(extractPackageNameFromSubjectRef('https://npmx.dev/package/@scope/pkg')).toBe(
      '@scope/pkg',
    )
    expect(extractPackageNameFromSubjectRef('https://example.com/not-npmx')).toBeNull()
  })
})

describe('normalizeLikesLeaderboardPayload', () => {
  it('normalizes upstream leaderboard payload into ranked entries', () => {
    const result = normalizeLikesLeaderboardPayload({
      leaderBoard: [
        { subjectRef: 'https://npmx.dev/package/vue', totalLikes: 120 },
        { subjectRef: 'https://npmx.dev/package/@nuxt/kit', totalLikes: 90 },
      ],
    })

    expect(result).toEqual([
      {
        rank: 1,
        packageName: 'vue',
        subjectRef: 'https://npmx.dev/package/vue',
        totalLikes: 120,
      },
      {
        rank: 2,
        packageName: '@nuxt/kit',
        subjectRef: 'https://npmx.dev/package/@nuxt/kit',
        totalLikes: 90,
      },
    ])
  })

  it('returns null for invalid upstream payloads', () => {
    expect(normalizeLikesLeaderboardPayload({ totalLikes: 10 })).toBeNull()
  })
})

describe('getLikesLeaderboard', () => {
  it('returns null when the upstream fetch fails', async () => {
    const cachedFetch = vi.fn().mockRejectedValue(new Error('boom'))

    const result = await getLikesLeaderboard(createEvent(cachedFetch))

    expect(result).toBeNull()
    expect(cachedFetch).toHaveBeenCalledOnce()
  })

  it('fetches from the external leaderboard API with limit=10', async () => {
    const cachedFetch = vi.fn().mockResolvedValue({
      data: {
        leaderBoard: [{ subjectRef: 'https://npmx.dev/package/vue', totalLikes: 120 }],
      },
      isStale: false,
      cachedAt: null,
    })

    await getLikesLeaderboard(createEvent(cachedFetch))

    expect(cachedFetch).toHaveBeenCalledWith(
      'https://npmx-likes-leaderboard-api-production.up.railway.app/api/leaderboard/likes?limit=10',
      expect.objectContaining({
        headers: {
          'User-Agent': 'npmx',
          'Accept': 'application/json',
        },
        signal: expect.any(AbortSignal),
      }),
      3600,
    )
  })
})

describe('getTopLikedRank', () => {
  it('returns the matching top liked rank for a subject ref', async () => {
    const cachedFetch = vi.fn().mockResolvedValue({
      data: {
        leaderBoard: [
          { subjectRef: 'https://npmx.dev/package/vue', totalLikes: 120 },
          { subjectRef: 'https://npmx.dev/package/nuxt', totalLikes: 90 },
        ],
      },
      isStale: false,
      cachedAt: null,
    })

    const rank = await getTopLikedRank(createEvent(cachedFetch), 'https://npmx.dev/package/nuxt')

    expect(rank).toBe(2)
  })
})
