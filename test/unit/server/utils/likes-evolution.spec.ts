import { describe, expect, it, vi, beforeEach, type Mocked } from 'vitest'
import { TID } from '@atproto/common'
import type { ConstellationLike } from '../../../../server/utils/atproto/utils/likes'
import type { CacheAdapter } from '../../../../server/utils/cache/shared'

vi.stubGlobal('CACHE_MAX_AGE_ONE_MINUTE', 60)
vi.stubGlobal('PACKAGE_SUBJECT_REF', (pkg: string) => `https://npmx.dev/package/${pkg}`)
vi.stubGlobal('$fetch', vi.fn())
vi.stubGlobal('Constellation', vi.fn())
vi.stubGlobal('getCacheAdapter', vi.fn())

vi.mock('#shared/types/lexicons/dev/npmx/feed/like.defs', () => ({
  $nsid: 'dev.npmx.feed.like',
}))

const { aggregateBacklinksByDay, PackageLikesUtils } =
  await import('../../../../server/utils/atproto/utils/likes')

function tidFromDate(date: Date): string {
  const microseconds = date.getTime() * 1000
  return TID.fromTime(microseconds, 0).toString()
}

function backlink(date: Date): { did: string; collection: string; rkey: string } {
  return { did: 'did:plc:test', collection: 'dev.npmx.feed.like', rkey: tidFromDate(date) }
}

describe('aggregateBacklinksByDay', () => {
  it('groups backlinks by day from TID rkeys', () => {
    const result = aggregateBacklinksByDay([
      backlink(new Date('2025-03-10T12:00:00.000Z')),
      backlink(new Date('2025-03-10T18:00:00.000Z')),
      backlink(new Date('2025-03-11T09:00:00.000Z')),
    ])

    expect(result).toEqual([
      { day: '2025-03-10', likes: 2 },
      { day: '2025-03-11', likes: 1 },
    ])
  })

  it('sorts results chronologically', () => {
    const result = aggregateBacklinksByDay([
      backlink(new Date('2025-05-03T10:00:00.000Z')),
      backlink(new Date('2025-05-01T10:00:00.000Z')),
      backlink(new Date('2025-05-02T10:00:00.000Z')),
    ])

    expect(result.map(r => r.day)).toEqual(['2025-05-01', '2025-05-02', '2025-05-03'])
  })

  it('skips non-TID rkeys with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = aggregateBacklinksByDay([
      { did: 'did:plc:user1', collection: 'dev.npmx.feed.like', rkey: 'not-a-valid-tid' },
      backlink(new Date('2025-04-20T10:00:00.000Z')),
    ])

    expect(result).toEqual([{ day: '2025-04-20', likes: 1 }])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('non-TID rkey'))

    warnSpy.mockRestore()
  })

  it('returns empty array for empty input', () => {
    expect(aggregateBacklinksByDay([])).toEqual([])
  })

  it('aggregates multiple likes on same day', () => {
    const result = aggregateBacklinksByDay([
      backlink(new Date('2025-07-04T08:00:00.000Z')),
      backlink(new Date('2025-07-04T12:00:00.000Z')),
      backlink(new Date('2025-07-04T20:00:00.000Z')),
    ])

    expect(result).toEqual([{ day: '2025-07-04', likes: 3 }])
  })
})

function makeBacklinksPage(
  records: Array<{ did: string; collection: string; rkey: string }>,
  cursor?: string,
) {
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

describe('PackageLikesUtils.getLikesEvolution', () => {
  const mockConstellation: Mocked<ConstellationLike> = {
    getBackLinks: vi.fn(),
    getLinksDistinctDids: vi.fn(),
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
  })

  it('paginates through backlinks and caches the result', async () => {
    const day1 = new Date('2025-01-15T10:00:00.000Z')
    const day2 = new Date('2025-01-16T10:00:00.000Z')

    // Page 1 returns a cursor
    mockConstellation.getBackLinks.mockResolvedValueOnce(
      makeBacklinksPage([backlink(day1)], 'cursor-page-2'),
    )
    // Page 2 returns no cursor (end)
    mockConstellation.getBackLinks.mockResolvedValueOnce(makeBacklinksPage([backlink(day2)]))

    const utils = new PackageLikesUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getLikesEvolution('react')

    expect(mockConstellation.getBackLinks).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      { day: '2025-01-15', likes: 1 },
      { day: '2025-01-16', likes: 1 },
    ])
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('evolution'),
      result,
      expect.any(Number),
    )
  })

  it('returns cached result without calling constellation', async () => {
    const cachedData = [{ day: '2025-06-01', likes: 5 }]
    mockCache.get.mockResolvedValueOnce(cachedData)

    const utils = new PackageLikesUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getLikesEvolution('lodash')

    expect(mockConstellation.getBackLinks).not.toHaveBeenCalled()
    expect(result).toEqual(cachedData)
  })

  it('returns empty array when no backlinks exist', async () => {
    mockConstellation.getBackLinks.mockResolvedValueOnce(makeBacklinksPage([]))

    const utils = new PackageLikesUtils({
      constellation: mockConstellation,
      cache: mockCache,
    })

    const result = await utils.getLikesEvolution('empty-pkg')

    expect(result).toEqual([])
  })
})
