import { beforeEach, describe, expect, it, vi, type Mocked } from 'vite-plus/test'
import type { ConstellationMentions } from '#server/utils/atproto/utils/social-mentions'
import type { CacheAdapter } from '#server/utils/cache/shared'

vi.stubGlobal('CACHE_MAX_AGE_ONE_HOUR', 60 * 60)
vi.stubGlobal('PACKAGE_SUBJECT_REF', (pkg: string) => `https://npmx.dev/package/${pkg}`)
vi.stubGlobal('$fetch', vi.fn())
vi.stubGlobal('Constellation', vi.fn())
vi.stubGlobal('getCacheAdapter', vi.fn())

const { PackageSocialMentionsUtils } = await import('#server/utils/atproto/utils/social-mentions')

type TestBacklink = {
  did: string
  collection: string
  rkey: string
}

function post(did: string, rkey: string): TestBacklink {
  return { did, collection: 'app.bsky.feed.post', rkey }
}

function makeBacklinksPage(records: TestBacklink[], cursor?: string) {
  return {
    data: {
      records,
      total: records.length,
      cursor,
    },
    isStale: false,
    cachedAt: null,
  }
}

describe('PackageSocialMentionsUtils.getMentions', () => {
  const mockConstellation: Mocked<ConstellationMentions> = {
    getBackLinks: vi.fn(),
  }
  // vi.fn() can't represent CacheAdapter's generic get<T>/set<T> signatures,
  // so we assert once here and get full type-safety everywhere else.
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  } as unknown as Mocked<CacheAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    mockCache.get.mockResolvedValue(undefined)
    mockCache.set.mockResolvedValue(undefined)
    mockConstellation.getBackLinks.mockResolvedValue(makeBacklinksPage([]))
  })

  it('counts unique posts across embed and facet links', async () => {
    const embed = 'https://npmx.dev/package/zod|embed.external.uri'
    const facet = 'https://npmx.dev/package/zod|facets[].features[app.bsky.richtext.facet#link].uri'

    mockConstellation.getBackLinks.mockImplementation(
      async (
        target: string,
        _collection: string,
        recordPath: string,
        _limit: number = 100,
        cursor?: string,
      ) => {
        const source = `${target}|${recordPath}`

        if (source === embed) {
          return cursor
            ? makeBacklinksPage([post('did:plc:a', 'post-c')])
            : makeBacklinksPage([post('did:plc:a', 'post-a'), post('did:plc:b', 'post-b')], 'next')
        }
        if (source === facet) {
          return makeBacklinksPage([post('did:plc:b', 'post-b'), post('did:plc:c', 'post-d')])
        }
        return makeBacklinksPage([])
      },
    )

    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('zod')

    expect(result).toEqual({ totalMentions: 4 })
    expect(mockConstellation.getBackLinks).toHaveBeenCalledTimes(3)
    expect(mockConstellation.getBackLinks).toHaveBeenCalledWith(
      'https://npmx.dev/package/zod',
      'app.bsky.feed.post',
      'embed.external.uri',
      100,
      undefined,
      false,
      [],
      0,
    )
    expect(mockConstellation.getBackLinks).toHaveBeenCalledWith(
      'https://npmx.dev/package/zod',
      'app.bsky.feed.post',
      'facets[].features[app.bsky.richtext.facet#link].uri',
      100,
      undefined,
      false,
      [],
      0,
    )
    expect(mockConstellation.getBackLinks).toHaveBeenCalledWith(
      'https://npmx.dev/package/zod',
      'app.bsky.feed.post',
      'embed.external.uri',
      100,
      'next',
      false,
      [],
      0,
    )
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('atproto-social-mentions:zod:total'),
      { totalMentions: 4 },
      expect.any(Number),
    )
  })

  it('returns cached mentions without calling constellation', async () => {
    mockCache.get.mockResolvedValueOnce({ totalMentions: 42 })

    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('react')

    expect(mockConstellation.getBackLinks).not.toHaveBeenCalled()
    expect(result).toEqual({ totalMentions: 42 })
  })

  it('caches a zero result', async () => {
    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('unmentioned-pkg')

    expect(result).toEqual({ totalMentions: 0 })
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('unmentioned-pkg:total'),
      { totalMentions: 0 },
      expect.any(Number),
    )
  })
})
