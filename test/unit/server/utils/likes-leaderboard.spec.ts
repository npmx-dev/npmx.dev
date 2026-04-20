import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNpmPackage } from '#server/utils/npm'
import { MICROLINK_API, NPM_API } from '#shared/utils/constants'
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

type TestEvent = Parameters<typeof getLikesLeaderboard>[0]
type TestCachedFetch = NonNullable<TestEvent['context']['cachedFetch']>
const fetchNpmPackageMock = vi.mocked(fetchNpmPackage)

function createEvent(cachedFetch: TestCachedFetch): TestEvent {
  return {
    context: { cachedFetch },
  } as TestEvent
}

function loadMicrolinkFixture(homepageUrl: string): unknown {
  const url = new URL(homepageUrl)
  const pathname = url.pathname === '/' ? '' : url.pathname.replaceAll('/', '_')
  const fixturePath = resolve(
    __dirname,
    '../../../fixtures/microlink',
    `${url.hostname}${pathname}.json`,
  )
  return JSON.parse(readFileSync(fixturePath, 'utf-8'))
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
      {
        rank: 1,
        packageName: 'vue',
        subjectRef: 'https://npmx.dev/package/vue',
        totalLikes: 120,
        packageDescription: null,
        weeklyDownloads: null,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: null,
        homepageLogoWidth: null,
        homepageLogoHeight: null,
      },
      {
        rank: 2,
        packageName: '@nuxt/kit',
        subjectRef: 'https://npmx.dev/package/@nuxt/kit',
        totalLikes: 90,
        packageDescription: null,
        weeklyDownloads: null,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: null,
        homepageLogoWidth: null,
        homepageLogoHeight: null,
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

describe('enrichLikesLeaderboardEntries', () => {
  it('adds github social preview images for highlighted entries only', async () => {
    fetchNpmPackageMock
      .mockResolvedValueOnce({
        description: 'The Progressive JavaScript Framework.',
        homepage: 'https://vuejs.org',
        repository: { url: 'https://github.com/vuejs/core' },
      } as Packument)
      .mockResolvedValueOnce({
        description: 'The Intuitive Vue Framework.',
        homepage: 'https://nuxt.com',
        repository: { url: 'git+https://github.com/nuxt/nuxt.git' },
      } as Packument)
      .mockResolvedValueOnce({
        description: 'The web framework for Svelte.',
        homepage: 'https://kit.svelte.dev',
        repository: { url: 'https://gitlab.com/sveltejs/kit' },
      } as Packument)
      .mockResolvedValueOnce({
        description: 'The library for web and native user interfaces.',
        homepage: 'https://react.dev',
      } as Packument)

    const cachedFetchMock = vi.fn(async (url: string) => {
      if (url.includes(`${NPM_API}/downloads/point/last-week/`)) {
        const packageName = decodeURIComponent(url.split('/last-week/')[1] ?? '')
        const downloadsMap: Record<string, number> = {
          'vue': 1200,
          'nuxt': 900,
          '@sveltejs/kit': 750,
          'react': 600,
        }

        return {
          data: {
            downloads: downloadsMap[packageName] ?? 0,
          },
          isStale: false,
          cachedAt: null,
        }
      }

      if (url.startsWith(`${MICROLINK_API}/?url=`)) {
        const homepageUrl = new URL(url).searchParams.get('url')
        if (!homepageUrl) {
          throw new Error(`Microlink request missing homepage URL: ${url}`)
        }

        return {
          data: loadMicrolinkFixture(homepageUrl),
          isStale: false,
          cachedAt: null,
        }
      }

      if (url.startsWith('https://ungh.cc/repos/')) {
        const starsMap: Record<string, number> = {
          'https://ungh.cc/repos/vuejs/core': 208000,
          'https://ungh.cc/repos/nuxt/nuxt': 59000,
        }

        return {
          data: {
            repo: {
              stars: starsMap[url] ?? 0,
            },
          },
          isStale: false,
          cachedAt: null,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    const cachedFetch = cachedFetchMock as unknown as TestCachedFetch

    const result = await enrichLikesLeaderboardEntries(createEvent(cachedFetch), [
      {
        rank: 1,
        packageName: 'vue',
        subjectRef: 'https://npmx.dev/package/vue',
        totalLikes: 120,
        packageDescription: null,
        weeklyDownloads: null,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: null,
        homepageLogoWidth: null,
        homepageLogoHeight: null,
      },
      {
        rank: 2,
        packageName: 'nuxt',
        subjectRef: 'https://npmx.dev/package/nuxt',
        totalLikes: 90,
        packageDescription: null,
        weeklyDownloads: null,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: null,
        homepageLogoWidth: null,
        homepageLogoHeight: null,
      },
      {
        rank: 3,
        packageName: '@sveltejs/kit',
        subjectRef: 'https://npmx.dev/package/@sveltejs/kit',
        totalLikes: 75,
        packageDescription: null,
        weeklyDownloads: null,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: null,
        homepageLogoWidth: null,
        homepageLogoHeight: null,
      },
      {
        rank: 4,
        packageName: 'react',
        subjectRef: 'https://npmx.dev/package/react',
        totalLikes: 60,
        packageDescription: null,
        weeklyDownloads: null,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: null,
        homepageLogoWidth: null,
        homepageLogoHeight: null,
      },
    ])

    expect(result).toEqual([
      expect.objectContaining({
        packageName: 'vue',
        packageDescription: 'The Progressive JavaScript Framework.',
        weeklyDownloads: 1200,
        repositoryStars: 208000,
        homepagePreviewUrl: expect.stringContaining('/api/registry/image-proxy?'),
        homepagePreviewWidth: 1200,
        homepagePreviewHeight: 630,
        homepageLogoUrl: expect.stringContaining('/api/registry/image-proxy?'),
        homepageLogoWidth: 256,
        homepageLogoHeight: 256,
      }),
      expect.objectContaining({
        packageName: 'nuxt',
        packageDescription: 'The Intuitive Vue Framework.',
        weeklyDownloads: 900,
        repositoryStars: 59000,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: expect.stringContaining('/api/registry/image-proxy?'),
        homepageLogoWidth: 256,
        homepageLogoHeight: 256,
      }),
      expect.objectContaining({
        packageName: '@sveltejs/kit',
        packageDescription: 'The web framework for Svelte.',
        weeklyDownloads: 750,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: expect.stringContaining('/api/registry/image-proxy?'),
        homepageLogoWidth: 256,
        homepageLogoHeight: 256,
      }),
      expect.objectContaining({
        packageName: 'react',
        packageDescription: 'The library for web and native user interfaces.',
        weeklyDownloads: 600,
        repositoryStars: null,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: expect.stringContaining('/api/registry/image-proxy?'),
        homepageLogoWidth: 256,
        homepageLogoHeight: 256,
      }),
    ])

    expect(fetchNpmPackageMock).toHaveBeenCalledTimes(4)
    expect(cachedFetchMock).toHaveBeenCalledWith(
      'https://api.microlink.io/?url=https%3A%2F%2Fvuejs.org',
      expect.objectContaining({
        headers: {
          'User-Agent': 'npmx',
          'Accept': 'application/json',
        },
        signal: expect.any(AbortSignal),
      }),
      86400,
    )
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
