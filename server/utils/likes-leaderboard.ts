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
  totalLikes: v.optional(v.number()),
  totalUniqueLikers: v.optional(v.number()),
  leaderBoard: v.array(UpstreamLikesLeaderboardEntrySchema),
})

type UpstreamLikesLeaderboardResponse = v.InferOutput<typeof UpstreamLikesLeaderboardResponseSchema>

export type ResolvedLikesLeaderboard = {
  totalLikes: number | null
  totalUniqueLikers: number | null
  entries: LikesLeaderboardEntry[]
}

const LIKES_LEADERBOARD_FETCH_TIMEOUT_MS = 750

type LikesLeaderboardOptions = {
  timeoutMs?: number
}

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

export function normalizeLikesLeaderboardPayload(
  payload: unknown,
): ResolvedLikesLeaderboard | null {
  const parsedPayload = v.safeParse(UpstreamLikesLeaderboardResponseSchema, payload)
  if (!parsedPayload.success) {
    return null
  }

  // PRECONDITION: the response is already sorted by totalLikes in descending order
  const entries = parsedPayload.output.leaderBoard
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

  return {
    totalLikes: parsedPayload.output.totalLikes ?? null,
    totalUniqueLikers: parsedPayload.output.totalUniqueLikers ?? null,
    entries,
  }
}

export async function getLikesLeaderboard(
  event: H3Event,
  options: LikesLeaderboardOptions = {},
): Promise<ResolvedLikesLeaderboard | null> {
  const timeoutMs = options.timeoutMs ?? LIKES_LEADERBOARD_FETCH_TIMEOUT_MS
  const cachedFetch = event.context.cachedFetch as CachedFetchFunction | undefined
  if (!cachedFetch) {
    console.error('Something went wrong: event.context.cachedFetch is missing. Aborting fetch.', {
      eventContext: event.context,
    })
    return null
  }

  try {
    const url = new URL(LIKES_LEADERBOARD_API_URL)
    url.searchParams.set('limit', LIKES_LEADERBOARD_MAX_ENTRIES.toString())

    const { data } = await cachedFetch<UpstreamLikesLeaderboardResponse>(
      url.toString(),
      {
        headers: {
          'User-Agent': 'npmx',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
      CACHE_MAX_AGE_ONE_HOUR,
    )

    return normalizeLikesLeaderboardPayload(data)
  } catch (err) {
    console.error('Failed to fetch likes leaderboard', { err })
    return null
  }
}

export async function getTopLikedRank(
  event: H3Event,
  subjectRef: string,
  options: LikesLeaderboardOptions = {},
): Promise<number | null> {
  const leaderboard = await getLikesLeaderboard(event, options)
  return leaderboard?.entries.find(entry => entry.subjectRef === subjectRef)?.rank ?? null
}
