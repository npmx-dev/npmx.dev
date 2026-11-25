import type { Redis } from '@upstash/redis'
import type { ConstellationLike } from '#server/utils/atproto/utils/likes'
import { afterAll, describe, expect, it, vi } from 'vite-plus/test'
import { RedisCacheAdapter } from '#server/utils/cache/redis'

vi.stubGlobal('CACHE_MAX_AGE_ONE_MINUTE', 60)
vi.stubGlobal('PACKAGE_SUBJECT_REF', (pkg: string) => `https://npmx.dev/package/${pkg}`)
vi.stubGlobal('getCacheAdapter', vi.fn())
vi.stubGlobal('Constellation', vi.fn())

const { PackageLikesUtils } = await import('#server/utils/atproto/utils/likes')

function createMemoryCache(): CacheAdapter {
  const store = new Map<string, unknown>()
  return {
    get: async <T>(key: string) => store.get(key) as T | undefined,
    set: async <T>(key: string, value: T) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    },
  }
}

function createMockConstellation(total = 0, userTotal = 0): ConstellationLike {
  return {
    getLinksDistinctDids: vi.fn(async () => ({
      data: { total, linking_dids: [] },
      isStale: false,
      cachedAt: null,
    })) as unknown as ConstellationLike['getLinksDistinctDids'],
    getBackLinks: vi.fn(async () => ({
      data: { total: userTotal, records: [] },
      isStale: false,
      cachedAt: null,
    })) as unknown as ConstellationLike['getBackLinks'],
  }
}

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('PackageLikesUtils caching', () => {
  it('caches zero total likes without re-querying constellation', async () => {
    const cache = createMemoryCache()
    const constellation = createMockConstellation(0, 0)
    const utils = new PackageLikesUtils({ cache, constellation })

    expect(await utils.getTotalLikes('zero-likes-pkg')).toBe(0)
    expect(await utils.getTotalLikes('zero-likes-pkg')).toBe(0)
    expect(constellation.getLinksDistinctDids).toHaveBeenCalledTimes(1)
  })

  it('caches false userHasLiked and zero totalLikes in getLikes', async () => {
    const cache = createMemoryCache()
    const constellation = createMockConstellation(0, 0)
    const utils = new PackageLikesUtils({ cache, constellation })

    const first = await utils.getLikes('zero-likes-pkg', 'did:plc:alice')
    const second = await utils.getLikes('zero-likes-pkg', 'did:plc:alice')

    expect(first).toEqual({ totalLikes: 0, userHasLiked: false, topLikedRank: null })
    expect(second).toEqual({ totalLikes: 0, userHasLiked: false, topLikedRank: null })
    expect(constellation.getLinksDistinctDids).toHaveBeenCalledTimes(1)
    expect(constellation.getBackLinks).toHaveBeenCalledTimes(1)
  })

  it('keeps cached count consistent across like and unlike down to zero', async () => {
    const cache = createMemoryCache()
    const constellation = createMockConstellation(0, 0)
    const utils = new PackageLikesUtils({ cache, constellation })

    expect(await utils.getTotalLikes('fresh-pkg')).toBe(0)

    const liked = await utils.likeAPackageAndReturnLikes(
      'fresh-pkg',
      'did:plc:alice',
      'at://did:plc:alice/dev.npmx.feed.like/3k2abc',
    )
    expect(liked).toEqual({ totalLikes: 1, userHasLiked: true, topLikedRank: null })
    expect(await utils.getLikes('fresh-pkg', 'did:plc:alice')).toEqual({
      totalLikes: 1,
      userHasLiked: true,
      topLikedRank: null,
    })

    const unliked = await utils.unlikeAPackageAndReturnLikes('fresh-pkg', 'did:plc:alice')
    expect(unliked).toEqual({ totalLikes: 0, userHasLiked: false, topLikedRank: null })
    expect(await utils.getLikes('fresh-pkg', 'did:plc:alice')).toEqual({
      totalLikes: 0,
      userHasLiked: false,
      topLikedRank: null,
    })
    expect(constellation.getLinksDistinctDids).toHaveBeenCalledTimes(1)
    expect(constellation.getBackLinks).not.toHaveBeenCalled()
  })
})

describe('RedisCacheAdapter', () => {
  it('returns cached falsy values (0 and false) and undefined only for null', async () => {
    const getMock = vi.fn()
    const redis = { get: getMock } as unknown as Redis
    const adapter = new RedisCacheAdapter(redis, 'generic')

    getMock.mockResolvedValueOnce(0)
    await expect(adapter.get<number>('zero')).resolves.toBe(0)

    getMock.mockResolvedValueOnce(false)
    await expect(adapter.get<boolean>('false')).resolves.toBe(false)

    getMock.mockResolvedValueOnce(null)
    await expect(adapter.get<number>('missing')).resolves.toBeUndefined()
  })
})
