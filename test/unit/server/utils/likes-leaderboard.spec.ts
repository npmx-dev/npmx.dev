import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNpmPackage } from '#server/utils/npm'
import { getHomepageMetadata } from '#server/utils/npm-homepage'
import { NPM_API } from '#shared/utils/constants'
import { createLikesLeaderboardEntry } from '~~/test/fixtures/likes-leaderboard'
import {
  enrichLikesLeaderboardEntries,
  extractPackageNameFromSubjectRef,
  getLikesLeaderboard,
  getTopLikedRank,
  normalizeLikesLeaderboardPayload,
} from '#server/utils/likes-leaderboard'

vi.mock('#server/utils/npm', () => ({
  fetchNpmPackage: vi.fn(),
}))

vi.mock('#server/utils/npm-homepage', () => ({
  getHomepageMetadata: vi.fn(),
}))

type TestEvent = Parameters<typeof getLikesLeaderboard>[0]
type TestCachedFetch = NonNullable<TestEvent['context']['cachedFetch']>
type HomepageMetadata = Awaited<ReturnType<typeof getHomepageMetadata>>
const fetchNpmPackageMock = vi.mocked(fetchNpmPackage)
const getHomepageMetadataMock = vi.mocked(getHomepageMetadata)

const emptyHomepageMetadata: HomepageMetadata = {
  homepageUrl: null,
  homepagePreviewUrl: null,
  homepagePreviewWidth: null,
  homepagePreviewHeight: null,
  homepageLogoUrl: null,
  homepageLogoWidth: null,
  homepageLogoHeight: null,
}

function createEvent(cachedFetch: TestCachedFetch): TestEvent {
  return {
    context: { cachedFetch },
  } as TestEvent
}

function homepageMetadata(overrides: Partial<HomepageMetadata> = {}): HomepageMetadata {
  return {
    ...emptyHomepageMetadata,
    ...overrides,
  }
}

function cachedResult(data: unknown) {
  return {
    data,
    isStale: false,
    cachedAt: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({
    imageProxySecret: 'image-proxy-secret',
  }))
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
      createLikesLeaderboardEntry('vue', {
        rank: 1,
        totalLikes: 120,
      }),
      createLikesLeaderboardEntry('@nuxt/kit', {
        rank: 2,
        totalLikes: 90,
      }),
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
    const cachedFetch = vi.fn().mockResolvedValue(
      cachedResult({
        leaderBoard: [{ subjectRef: 'https://npmx.dev/package/vue', totalLikes: 120 }],
      }),
    )

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

describe('enrichLikesLeaderboardEntries', () => {
  it('enriches entries with package, download, github, and homepage metadata', async () => {
    const packuments: Record<string, Partial<Packument>> = {
      'vue': {
        description: 'The Progressive JavaScript Framework.',
        homepage: 'https://vuejs.org',
        repository: { url: 'https://github.com/vuejs/core' },
      },
      'nuxt': {
        description: 'The Intuitive Vue Framework.',
        homepage: 'https://nuxt.com',
        repository: { url: 'git+https://github.com/nuxt/nuxt.git' },
      },
      '@sveltejs/kit': {
        description: 'The web framework for Svelte.',
        homepage: 'https://kit.svelte.dev',
        repository: { url: 'https://gitlab.com/sveltejs/kit' },
      },
      'react': {
        description: 'The library for web and native user interfaces.',
        homepage: 'https://react.dev',
      },
    }
    fetchNpmPackageMock.mockImplementation(async packageName => {
      const packument = packuments[packageName]
      if (!packument) {
        throw new Error(`Unexpected package lookup: ${packageName}`)
      }

      return packument as Packument
    })
    getHomepageMetadataMock.mockImplementation(async (_event, homepageUrl) =>
      homepageMetadata({
        homepageUrl,
        homepagePreviewUrl: homepageUrl === 'https://vuejs.org' ? 'preview:vue' : null,
        homepagePreviewWidth: homepageUrl === 'https://vuejs.org' ? 1200 : null,
        homepagePreviewHeight: homepageUrl === 'https://vuejs.org' ? 630 : null,
        homepageLogoUrl: homepageUrl ? `logo:${homepageUrl}` : null,
        homepageLogoWidth: homepageUrl ? 256 : null,
        homepageLogoHeight: homepageUrl ? 256 : null,
      }),
    )

    const cachedFetchMock = vi.fn(async (url: string) => {
      if (url.includes(`${NPM_API}/downloads/point/last-week/`)) {
        const packageName = decodeURIComponent(url.split('/last-week/')[1] ?? '')
        const downloadsMap: Record<string, number> = {
          'vue': 1200,
          'nuxt': 900,
          '@sveltejs/kit': 750,
          'react': 600,
        }

        return cachedResult({
          downloads: downloadsMap[packageName] ?? 0,
        })
      }

      if (url.startsWith('https://ungh.cc/repos/')) {
        const starsMap: Record<string, number> = {
          'https://ungh.cc/repos/vuejs/core': 208000,
          'https://ungh.cc/repos/nuxt/nuxt': 59000,
        }

        return cachedResult({
          repo: {
            stars: starsMap[url] ?? 0,
          },
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    const cachedFetch = cachedFetchMock as unknown as TestCachedFetch

    const event = createEvent(cachedFetch)
    const result = await enrichLikesLeaderboardEntries(event, [
      createLikesLeaderboardEntry('vue', {
        rank: 1,
        totalLikes: 120,
      }),
      createLikesLeaderboardEntry('nuxt', {
        rank: 2,
        totalLikes: 90,
      }),
      createLikesLeaderboardEntry('@sveltejs/kit', {
        rank: 3,
        totalLikes: 75,
      }),
      createLikesLeaderboardEntry('react', {
        rank: 4,
        totalLikes: 60,
      }),
    ])

    expect(result).toMatchObject([
      {
        packageName: 'vue',
        packageDescription: 'The Progressive JavaScript Framework.',
        weeklyDownloads: 1200,
        repositoryStars: 208000,
        homepagePreviewUrl: 'preview:vue',
        homepageLogoUrl: 'logo:https://vuejs.org',
      },
      {
        packageName: 'nuxt',
        packageDescription: 'The Intuitive Vue Framework.',
        weeklyDownloads: 900,
        repositoryStars: 59000,
        homepagePreviewUrl: null,
        homepageLogoUrl: 'logo:https://nuxt.com',
      },
      {
        packageName: '@sveltejs/kit',
        packageDescription: 'The web framework for Svelte.',
        weeklyDownloads: 750,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepageLogoUrl: 'logo:https://kit.svelte.dev',
      },
      {
        packageName: 'react',
        packageDescription: 'The library for web and native user interfaces.',
        weeklyDownloads: 600,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepageLogoUrl: 'logo:https://react.dev',
      },
    ])

    expect(fetchNpmPackageMock).toHaveBeenCalledTimes(4)
    expect(getHomepageMetadataMock).toHaveBeenCalledWith(event, 'https://vuejs.org')
    expect(cachedFetchMock).toHaveBeenCalledWith(
      'https://ungh.cc/repos/vuejs/core',
      expect.objectContaining({
        headers: {
          'User-Agent': 'npmx',
          'Accept': 'application/json',
        },
      }),
      3600,
    )
  })
})

describe('getTopLikedRank', () => {
  it('returns the matching top liked rank for a subject ref', async () => {
    const cachedFetch = vi.fn().mockResolvedValue(
      cachedResult({
        leaderBoard: [
          { subjectRef: 'https://npmx.dev/package/vue', totalLikes: 120 },
          { subjectRef: 'https://npmx.dev/package/nuxt', totalLikes: 90 },
        ],
      }),
    )

    const rank = await getTopLikedRank(createEvent(cachedFetch), 'https://npmx.dev/package/nuxt')

    expect(rank).toBe(2)
  })
})
