import { beforeEach, describe, expect, it, vi, type Mocked } from 'vite-plus/test'
import type { ConstellationMentions } from '#server/utils/atproto/utils/social-mentions'
import type { CacheAdapter } from '#server/utils/cache/shared'

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

  it('deduplicates posts across embed and facet links', async () => {
    mockConstellation.getBackLinks
      .mockResolvedValueOnce(
        makeBacklinksPage([post('did:plc:a', 'post-a'), post('did:plc:b', 'post-b')]),
      )
      .mockResolvedValueOnce(
        makeBacklinksPage([post('did:plc:b', 'post-b'), post('did:plc:c', 'post-c')]),
      )

    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('zod')

    expect(result).toEqual({ totalMentions: 3, isCapped: false })
    expect(mockConstellation.getBackLinks).toHaveBeenCalledTimes(2)
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
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('atproto-social-mentions:zod:total'),
      { totalMentions: 3, isCapped: false },
      expect.any(Number),
    )
  })

  it('caps at 99 when a source has another page', async () => {
    mockConstellation.getBackLinks
      .mockResolvedValueOnce(makeBacklinksPage([post('did:plc:a', 'post-a')], 'next'))
      .mockResolvedValueOnce(makeBacklinksPage([post('did:plc:b', 'post-b')]))

    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('zod')

    expect(result).toEqual({ totalMentions: 99, isCapped: true })
    expect(mockConstellation.getBackLinks).toHaveBeenCalledTimes(2)
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('atproto-social-mentions:zod:total'),
      { totalMentions: 99, isCapped: true },
      expect.any(Number),
    )
  })

  it('caps at 99 when unique posts exceed 99', async () => {
    mockConstellation.getBackLinks.mockResolvedValueOnce(
      makeBacklinksPage(Array.from({ length: 100 }, (_, i) => post('did:plc:a', `post-${i}`))),
    )

    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('zod')

    expect(result).toEqual({ totalMentions: 99, isCapped: true })
  })

  it('does not cap exactly 99 unique posts', async () => {
    mockConstellation.getBackLinks.mockResolvedValueOnce(
      makeBacklinksPage(Array.from({ length: 99 }, (_, i) => post('did:plc:a', `post-${i}`))),
    )

    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('zod')

    expect(result).toEqual({ totalMentions: 99, isCapped: false })
  })

  it('returns cached mentions without calling constellation', async () => {
    mockCache.get.mockResolvedValueOnce({ totalMentions: 42, isCapped: false })

    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('react')

    expect(mockConstellation.getBackLinks).not.toHaveBeenCalled()
    expect(result).toEqual({ totalMentions: 42, isCapped: false })
  })

  it('caches a zero result', async () => {
    const utils = new PackageSocialMentionsUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getMentions('unmentioned-pkg')

    expect(result).toEqual({ totalMentions: 0, isCapped: false })
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('unmentioned-pkg:total'),
      { totalMentions: 0, isCapped: false },
      expect.any(Number),
    )
  })
})
