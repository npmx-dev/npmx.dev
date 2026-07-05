import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNpmPackage } from '#server/utils/npm'
import { MICROLINK_API } from '#shared/utils/constants'
import { getHomepageMetadata, getPackageHomepageMetadata } from '#server/utils/npm-homepage'

vi.mock('#server/utils/npm', () => ({
  fetchNpmPackage: vi.fn(),
}))

type TestEvent = Parameters<typeof getHomepageMetadata>[0]
type TestCachedFetch = NonNullable<TestEvent['context']['cachedFetch']>
const fetchNpmPackageMock = vi.mocked(fetchNpmPackage)

function createEvent(cachedFetch?: TestCachedFetch): TestEvent {
  return {
    context: cachedFetch ? { cachedFetch } : {},
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

function createMicrolinkCachedFetch(): TestCachedFetch {
  return vi.fn(async (url: string) => {
    if (url.startsWith(`${MICROLINK_API}/?url=`)) {
      const homepageUrl = new URL(url).searchParams.get('url')
      if (!homepageUrl) throw new Error(`Microlink request missing homepage URL: ${url}`)

      return {
        data: loadMicrolinkFixture(homepageUrl),
        isStale: false,
        cachedAt: null,
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }) as TestCachedFetch
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({
    imageProxySecret: 'image-proxy-secret',
  }))
})

describe('getHomepageMetadata', () => {
  it('returns proxied preview and logo URLs from Microlink fixtures', async () => {
    const cachedFetch = createMicrolinkCachedFetch()
    const result = await getHomepageMetadata(createEvent(cachedFetch), 'https://vuejs.org')

    expect(result).toEqual({
      homepageUrl: 'https://vuejs.org',
      homepagePreviewUrl: expect.stringContaining('/api/registry/image-proxy?'),
      homepagePreviewWidth: 1200,
      homepagePreviewHeight: 630,
      homepageLogoUrl: expect.stringContaining('/api/registry/image-proxy?'),
      homepageLogoWidth: 256,
      homepageLogoHeight: 256,
    })
  })

  it('returns empty metadata when homepage is missing', async () => {
    const cachedFetch = vi.fn() as TestCachedFetch

    const result = await getHomepageMetadata(createEvent(cachedFetch), null)

    expect(result).toEqual({
      homepageUrl: null,
      homepagePreviewUrl: null,
      homepagePreviewWidth: null,
      homepagePreviewHeight: null,
      homepageLogoUrl: null,
      homepageLogoWidth: null,
      homepageLogoHeight: null,
    })
    expect(cachedFetch).not.toHaveBeenCalled()
  })
})

describe('getPackageHomepageMetadata', () => {
  it('loads homepage metadata from the package homepage field', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      homepage: 'https://nuxt.com',
    } as Packument)

    const cachedFetch = createMicrolinkCachedFetch()
    const result = await getPackageHomepageMetadata(createEvent(cachedFetch), 'nuxt')

    expect(result).toEqual({
      homepageUrl: 'https://nuxt.com',
      homepagePreviewUrl: null,
      homepagePreviewWidth: null,
      homepagePreviewHeight: null,
      homepageLogoUrl: expect.stringContaining('/api/registry/image-proxy?'),
      homepageLogoWidth: 256,
      homepageLogoHeight: 256,
    })
  })
})
