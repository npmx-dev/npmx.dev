import type { H3Event } from 'h3'
import * as v from 'valibot'
import type { LikesLeaderboardEntry } from '#shared/types/social'
import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'
import { getHomepageMetadata } from '#server/utils/npm-homepage'
import { fetchNpmPackage } from '#server/utils/npm'
import { GIT_PROVIDER_API_ORIGINS, parseRepoUrl, type RepoRef } from '#shared/utils/git-providers'
import { encodePackageName } from '#shared/utils/npm'
import {
  CACHE_MAX_AGE_FIVE_MINUTES,
  CACHE_MAX_AGE_ONE_HOUR,
  LIKES_LEADERBOARD_API_URL,
  NPM_API,
} from '#shared/utils/constants'

const UpstreamLikesLeaderboardEntrySchema = v.object({
  subjectRef: v.string(),
  totalLikes: v.number(),
})

const UpstreamLikesLeaderboardResponseSchema = v.object({
  leaderBoard: v.array(UpstreamLikesLeaderboardEntrySchema),
})

const LIKES_LEADERBOARD_FETCH_TIMEOUT_MS = 750

const GithubRepositoryMetaResponseSchema = v.object({
  repo: v.nullable(
    v.object({
      stars: v.optional(v.number()),
    }),
  ),
})

const NpmDownloadCountSchema = v.object({
  downloads: v.number(),
})

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
          packageDescription: null,
          weeklyDownloads: null,
          repositoryStars: null,
          homepagePreviewUrl: null,
          homepagePreviewWidth: null,
          homepagePreviewHeight: null,
          homepageLogoUrl: null,
          homepageLogoWidth: null,
          homepageLogoHeight: null,
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

async function getLeaderboardEntryMetadata(
  cachedFetch: CachedFetchFunction,
  packageName: string,
): Promise<{
  packageDescription: string | null
  weeklyDownloads: number | null
  homepageUrl: string | null
  githubRepositoryRef: RepoRef | null
}> {
  try {
    const encodedPackageName = encodePackageName(packageName)
    const [packument, downloadsResult] = await Promise.all([
      fetchNpmPackage(packageName),
      cachedFetch<unknown>(
        `${NPM_API}/downloads/point/last-week/${encodedPackageName}`,
        {
          headers: {
            'User-Agent': 'npmx',
            'Accept': 'application/json',
          },
        },
        CACHE_MAX_AGE_FIVE_MINUTES,
      ).catch(() => null),
    ])
    const rawRepositoryUrl =
      typeof packument.repository === 'string' ? packument.repository : packument.repository?.url
    const packageDescription =
      typeof packument.description === 'string' ? packument.description : null
    const homepageUrl = typeof packument.homepage === 'string' ? packument.homepage : null
    const parsedDownloads = downloadsResult
      ? v.safeParse(NpmDownloadCountSchema, downloadsResult.data)
      : null
    const weeklyDownloads = parsedDownloads?.success ? parsedDownloads.output.downloads : null
    if (!rawRepositoryUrl) {
      return {
        packageDescription,
        weeklyDownloads,
        homepageUrl,
        githubRepositoryRef: null,
      }
    }

    const repositoryRef = parseRepoUrl(rawRepositoryUrl)
    if (!repositoryRef || repositoryRef.provider !== 'github') {
      return {
        packageDescription,
        weeklyDownloads,
        homepageUrl,
        githubRepositoryRef: null,
      }
    }

    return {
      packageDescription,
      weeklyDownloads,
      homepageUrl,
      githubRepositoryRef: repositoryRef,
    }
  } catch {
    return {
      packageDescription: null,
      weeklyDownloads: null,
      homepageUrl: null,
      githubRepositoryRef: null,
    }
  }
}

async function getGithubRepositoryStars(
  cachedFetch: CachedFetchFunction,
  githubRepositoryRef: RepoRef,
): Promise<number | null> {
  try {
    const { data } = await cachedFetch<unknown>(
      `${GIT_PROVIDER_API_ORIGINS.github}/repos/${githubRepositoryRef.owner}/${githubRepositoryRef.repo}`,
      {
        headers: {
          'User-Agent': 'npmx',
          'Accept': 'application/json',
        },
      },
      CACHE_MAX_AGE_ONE_HOUR,
    )

    const parsedResponse = v.safeParse(GithubRepositoryMetaResponseSchema, data)
    if (!parsedResponse.success) return null

    return parsedResponse.output.repo?.stars ?? null
  } catch {
    return null
  }
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

export async function enrichLikesLeaderboardEntries(
  event: H3Event,
  leaderboardEntries: LikesLeaderboardEntry[],
): Promise<LikesLeaderboardEntry[]> {
  const cachedFetch = event.context.cachedFetch as CachedFetchFunction | undefined
  if (!cachedFetch) {
    return leaderboardEntries
  }

  return await Promise.all(
    leaderboardEntries.map(async entry => {
      const { packageDescription, weeklyDownloads, homepageUrl, githubRepositoryRef } =
        await getLeaderboardEntryMetadata(cachedFetch, entry.packageName)
      const [homepageMetadata, repositoryStars] = await Promise.all([
        getHomepageMetadata(event, homepageUrl),
        githubRepositoryRef ? getGithubRepositoryStars(cachedFetch, githubRepositoryRef) : null,
      ])

      return {
        ...entry,
        packageDescription,
        weeklyDownloads,
        repositoryStars,
        homepagePreviewUrl: homepageMetadata.homepagePreviewUrl,
        homepagePreviewWidth: homepageMetadata.homepagePreviewWidth,
        homepagePreviewHeight: homepageMetadata.homepagePreviewHeight,
        homepageLogoUrl: homepageMetadata.homepageLogoUrl,
        homepageLogoWidth: homepageMetadata.homepageLogoWidth,
        homepageLogoHeight: homepageMetadata.homepageLogoHeight,
      }
    }),
  )
}

export async function getTopLikedRank(event: H3Event, subjectRef: string): Promise<number | null> {
  const leaderboard = await getLikesLeaderboard(event)
  return leaderboard?.find(entry => entry.subjectRef === subjectRef)?.rank ?? null
}
