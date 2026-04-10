import type { H3Event } from 'h3'
import * as v from 'valibot'
import type { LikesLeaderboardEntry } from '#shared/types/social'
import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'
import { CACHE_MAX_AGE_ONE_HOUR, LIKES_LEADERBOARD_API_URL } from '#shared/utils/constants'

const UpstreamLikesLeaderboardEntrySchema = v.object({
  subjectRef: v.string(),
  totalLikes: v.number(),
})

const UpstreamLikesLeaderboardResponseSchema = v.object({
  leaderBoard: v.array(UpstreamLikesLeaderboardEntrySchema),
})

const LIKES_LEADERBOARD_FETCH_TIMEOUT_MS = 750

export const LIKES_LEADERBOARD_MAX_ENTRIES = 10

export function extractPackageNameFromSubjectRef(subjectRef: string): string | null {
  const match = /^https:\/\/npmx\.dev\/package\/(.+)$/.exec(subjectRef)
  if (!match?.[1]) return null

  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function normalizeLikesLeaderboardPayload(payload: unknown): LikesLeaderboardEntry[] | null {
  const parsedPayload = v.safeParse(UpstreamLikesLeaderboardResponseSchema, payload)
  if (!parsedPayload.success) {
    return null
  }

  // PRECONDITION: the response is already sorted by totalLikes in descending order
  return (
    parsedPayload.output.leaderBoard
      .map((entry): LikesLeaderboardEntry | null => {
        const packageName = extractPackageNameFromSubjectRef(entry.subjectRef)
        if (!packageName) return null

        return {
          rank: 0,
          packageName,
          subjectRef: entry.subjectRef,
          totalLikes: entry.totalLikes,
        }
      })
      .filter((entry): entry is LikesLeaderboardEntry => entry !== null)
      // oxlint-disable-next-line no-map-spread -- only a few elements
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
  )
}

export async function getLikesLeaderboard(event: H3Event): Promise<LikesLeaderboardEntry[] | null> {
  const cachedFetch = event.context.cachedFetch as CachedFetchFunction | undefined
  if (!cachedFetch) {
    console.error('[likes-leaderboard] Missing cachedFetch in request context')
    return null
  }

  try {
    const url = new URL(LIKES_LEADERBOARD_API_URL)
    url.searchParams.set('limit', LIKES_LEADERBOARD_MAX_ENTRIES.toString())

    const { data } = await cachedFetch(
      url.toString(),
      {
        headers: {
          'User-Agent': 'npmx',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(LIKES_LEADERBOARD_FETCH_TIMEOUT_MS),
      },
      CACHE_MAX_AGE_ONE_HOUR,
    )

    return normalizeLikesLeaderboardPayload(data)
  } catch (err) {
    console.error(
      '[likes-leaderboard] Failed to fetch likes leaderboard:',
      err instanceof Error ? err.message : 'Unknown error',
    )
    return null
  }
}

export async function getTopLikedRank(event: H3Event, subjectRef: string): Promise<number | null> {
  const leaderboard = await getLikesLeaderboard(event)
  return leaderboard?.find(entry => entry.subjectRef === subjectRef)?.rank ?? null
}
