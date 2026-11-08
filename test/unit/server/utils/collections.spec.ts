import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { CacheAdapter } from '#server/utils/cache/shared'
import type { MiniDoc } from '#shared/types/social'
import type { Backlink } from '#shared/utils/constellation'
import { COLLECTION_SUBJECT_REF, PACKAGE_SUBJECT_REF } from '#shared/utils/constants'

const { CollectionsUtils } = await import('#server/utils/atproto/utils/collections')
const { AccountModerationUtils, BLUESKY_MODERATION_DID, isHiddenByLabels } =
  await import('#server/utils/atproto/utils/moderation')

type Deps = NonNullable<ConstructorParameters<typeof CollectionsUtils>[0]>

const ALICE = 'did:plc:alice'
const BOB = 'did:plc:bob'
const MALLORY = 'did:plc:mallory'
const RKEY_A = '3m5k5baifas2a'
const RKEY_B = '3m5k5baifas2b'
const RKEY_C = '3m5k5baifas2c'

// Mirrors RedisCacheAdapter, which returns undefined for falsy values
function memoryCache(): CacheAdapter {
  const store = new Map<string, unknown>()
  return {
    get: async <T>(key: string) => (store.get(key) || undefined) as T | undefined,
    set: async (key, value) => void store.set(key, value),
    delete: async key => void store.delete(key),
  }
}

const miniDoc = (did: string): MiniDoc => ({
  did,
  handle: `${did.split(':').pop()}.test`,
  pds: `https://pds.${did.split(':').pop()}.test`,
  signing_key: 'key',
})

const record = (name: string, subjectRefs: string[]) => ({
  $type: 'dev.npmx.collection',
  name,
  items: subjectRefs.map(subjectRef => ({ subjectRef })),
  createdAt: '2026-11-01T00:00:00.000Z',
})

type RecordMap = Record<string, unknown>
const key = (did: string, rkey: string) => `${did}/${rkey}`

function setup(records: RecordMap, overrides: Partial<Deps> = {}) {
  const constellation = {
    getBackLinks: vi.fn(async (..._args: unknown[]) => ({
      data: { total: 0, records: [] as Backlink[], cursor: undefined as string | undefined },
      isStale: false,
      cachedAt: null,
    })),
    getLinksDistinctDids: vi.fn(async (..._args: unknown[]) => ({
      data: { total: 0, linking_dids: [] as string[], cursor: undefined as string | undefined },
      isStale: false,
      cachedAt: null,
    })),
  }
  const fetchRecord = vi.fn(async (doc: MiniDoc, rkey: string) => {
    const value = records[key(doc.did, rkey)]
    return value ? { uri: COLLECTION_SUBJECT_REF(doc.did, rkey), cid: `cid-${rkey}`, value } : null
  })
  const deps: Deps = {
    constellation: constellation as unknown as Deps['constellation'],
    cache: memoryCache(),
    resolveIdentity: async identifier => miniDoc(identifier),
    fetchRecord,
    listRecords: async () => ({ records: [] }),
    listFollows: async () => ({ records: [] }),
    packageExists: async name => name !== 'does-not-exist',
    moderation: { getHiddenDids: async () => new Set(), isHidden: async () => false },
    ...overrides,
  }
  return { utils: new CollectionsUtils(deps), constellation, fetchRecord }
}

describe('CollectionsUtils.getCollection', () => {
  it('resolves package items and flags unknown packages', async () => {
    const { utils } = setup({
      [key(ALICE, RKEY_A)]: record('Parsers', [
        PACKAGE_SUBJECT_REF('commander'),
        PACKAGE_SUBJECT_REF('does-not-exist'),
        'https://example.com/whatever',
      ]),
    })

    const view = await utils.getCollection(ALICE, RKEY_A)

    expect(view?.name).toBe('Parsers')
    expect(view?.itemCount).toBe(3)
    expect(view?.items).toEqual([
      expect.objectContaining({ kind: 'package', packageName: 'commander', resolved: true }),
      expect.objectContaining({ kind: 'package', packageName: 'does-not-exist', resolved: false }),
      expect.objectContaining({ kind: 'unknown', subjectRef: 'https://example.com/whatever' }),
    ])
  })

  it('treats registry errors as resolved', async () => {
    const { utils } = setup(
      { [key(ALICE, RKEY_A)]: record('x', [PACKAGE_SUBJECT_REF('zod')]) },
      { packageExists: async () => Promise.reject(new Error('registry down')) },
    )
    const view = await utils.getCollection(ALICE, RKEY_A)
    expect(view?.items[0]).toMatchObject({ kind: 'package', resolved: true })
  })

  it('returns null for missing and invalid records', async () => {
    const { utils } = setup({ [key(ALICE, RKEY_B)]: { name: 'no items or createdAt' } })
    expect(await utils.getCollection(ALICE, RKEY_A)).toBeNull()
    expect(await utils.getCollection(ALICE, RKEY_B)).toBeNull()
  })

  it('returns null when the author is hidden', async () => {
    const { utils } = setup(
      { [key(MALLORY, RKEY_A)]: record('x', []) },
      {
        moderation: {
          getHiddenDids: async () => new Set([MALLORY]),
          isHidden: async did => did === MALLORY,
        },
      },
    )
    expect(await utils.getCollection(MALLORY, RKEY_A)).toBeNull()
  })

  it("names records by the owner's DID, not the URI their PDS reports", async () => {
    const { utils } = setup(
      {},
      {
        fetchRecord: async () => ({
          uri: COLLECTION_SUBJECT_REF(BOB, RKEY_A),
          cid: 'cid',
          value: record('x', []),
        }),
      },
    )
    const view = await utils.getCollection(MALLORY, RKEY_A)
    expect(view?.uri).toBe(COLLECTION_SUBJECT_REF(MALLORY, RKEY_A))
  })

  it('builds the URI itself when caching a write', async () => {
    const { utils, fetchRecord } = setup({})
    await utils.setStoredRecord(MALLORY, RKEY_A, { cid: 'cid', value: record('x', []) as never })
    const view = await utils.getCollection(MALLORY, RKEY_A)
    expect(fetchRecord).not.toHaveBeenCalled()
    expect(view?.uri).toBe(COLLECTION_SUBJECT_REF(MALLORY, RKEY_A))
  })

  it('shows included collections as summaries without expanding them', async () => {
    const { utils, fetchRecord } = setup({
      [key(ALICE, RKEY_A)]: record('A', [COLLECTION_SUBJECT_REF(BOB, RKEY_B)]),
      [key(BOB, RKEY_B)]: record('B', [COLLECTION_SUBJECT_REF(ALICE, RKEY_A)]),
    })

    const view = await utils.getCollection(ALICE, RKEY_A)

    expect(view?.items).toEqual([
      expect.objectContaining({
        kind: 'collection',
        collection: expect.objectContaining({ name: 'B', handle: 'bob.test', itemCount: 1 }),
      }),
    ])
    expect(view?.items[0]).not.toHaveProperty('collection.items')
    // B's own include of A isn't followed, so cycles can't happen
    expect(fetchRecord).toHaveBeenCalledTimes(2)
  })

  it('marks hidden and unresolvable nested collections', async () => {
    const { utils } = setup(
      {
        [key(ALICE, RKEY_A)]: record('A', [
          COLLECTION_SUBJECT_REF(MALLORY, RKEY_B),
          COLLECTION_SUBJECT_REF(BOB, RKEY_C),
        ]),
        [key(MALLORY, RKEY_B)]: record('spam', []),
      },
      {
        moderation: {
          getHiddenDids: async dids => new Set(dids.filter(did => did === MALLORY)),
          isHidden: async did => did === MALLORY,
        },
      },
    )

    const view = await utils.getCollection(ALICE, RKEY_A)

    expect(view?.items).toEqual([
      expect.objectContaining({ collection: null, unavailableReason: 'hidden' }),
      expect.objectContaining({ collection: null, unavailableReason: 'unresolvable' }),
    ])
  })

  it('aggregates like, follow and included-in stats', async () => {
    const { utils, constellation } = setup({ [key(ALICE, RKEY_A)]: record('A', []) })
    constellation.getLinksDistinctDids.mockImplementation(async (...args: unknown[]) => ({
      data: {
        total: args[1] === 'dev.npmx.feed.like' ? 7 : 2,
        linking_dids: [],
        cursor: undefined,
      },
      isStale: false,
      cachedAt: null,
    }))
    constellation.getBackLinks.mockImplementation(async (...args: unknown[]) => ({
      data: {
        total: args[1] === 'dev.npmx.feed.like' ? 1 : 3,
        records:
          args[1] === 'dev.npmx.feed.like'
            ? [{ did: BOB, collection: 'dev.npmx.feed.like', rkey: '3likerkey' }]
            : [],
        cursor: undefined,
      },
      isStale: false,
      cachedAt: null,
    }))

    const view = await utils.getCollection(ALICE, RKEY_A, BOB)

    expect(view).toMatchObject({
      likes: { total: 7, viewerHas: true },
      follows: { total: 2, viewerHas: false },
      includedInCount: 3,
    })
    expect(constellation.getLinksDistinctDids).toHaveBeenCalledWith(
      COLLECTION_SUBJECT_REF(ALICE, RKEY_A),
      'dev.npmx.feed.like',
      '.subjectRef',
      1,
      undefined,
      0,
    )
  })

  it('caches records, including misses', async () => {
    const { utils, fetchRecord } = setup({ [key(ALICE, RKEY_A)]: record('A', []) })
    await utils.getCollection(ALICE, RKEY_A)
    await utils.getCollection(ALICE, RKEY_A)
    await utils.getCollection(ALICE, RKEY_B)
    await utils.getCollection(ALICE, RKEY_B)
    expect(fetchRecord).toHaveBeenCalledTimes(2)
  })
})

describe('CollectionsUtils reactions', () => {
  const uri = COLLECTION_SUBJECT_REF(ALICE, RKEY_A)

  it.each([
    ['like', 'dev.npmx.feed.like', '.subjectRef'],
    ['follow', 'dev.npmx.graph.follow', '.subject'],
  ] as const)(
    'counts a %s immediately, before Constellation sees it',
    async (reaction, nsid, path) => {
      const { utils, constellation } = setup({})
      constellation.getLinksDistinctDids.mockResolvedValue({
        data: { total: 2, linking_dids: [], cursor: undefined },
        isStale: false,
        cachedAt: null,
      })

      const before = await utils.getReactionTotal(reaction, uri)
      expect(await utils.recordReaction(reaction, uri, BOB, '3recordkey', before)).toEqual({
        total: 3,
        viewerHas: true,
      })
      expect(await utils.getReaction(reaction, uri, BOB)).toEqual({ total: 3, viewerHas: true })
      expect(await utils.getViewerReaction(reaction, uri, BOB)).toEqual({
        did: BOB,
        collection: nsid,
        rkey: '3recordkey',
      })
      expect(constellation.getLinksDistinctDids).toHaveBeenCalledWith(
        uri,
        nsid,
        path,
        1,
        undefined,
        0,
      )

      expect(await utils.recordUnreaction(reaction, uri, BOB, 3)).toEqual({
        total: 2,
        viewerHas: false,
      })
      expect(await utils.getViewerReaction(reaction, uri, BOB)).toBeNull()
      expect(constellation.getLinksDistinctDids).toHaveBeenCalledTimes(1)
    },
  )

  it('keeps likes and follows apart', async () => {
    const { utils } = setup({})
    await utils.recordReaction('like', uri, BOB, '3likerkey', 0)
    expect(await utils.getReaction('follow', uri, BOB)).toEqual({ total: 0, viewerHas: false })
  })

  it('never goes below zero', async () => {
    const { utils } = setup({})
    expect(await utils.recordUnreaction('like', uri, BOB, 0)).toEqual({
      total: 0,
      viewerHas: false,
    })
  })
})

describe('CollectionsUtils.listFollowedCollections', () => {
  it('hydrates followed collections and drops unknown, missing and duplicate subjects', async () => {
    const { utils } = setup(
      { [key(ALICE, RKEY_A)]: record('Parsers', []) },
      {
        listFollows: async () => ({
          cursor: 'next',
          records: [
            { rkey: 'f1', subject: COLLECTION_SUBJECT_REF(ALICE, RKEY_A) },
            { rkey: 'f2', subject: COLLECTION_SUBJECT_REF(ALICE, RKEY_A) },
            { rkey: 'f3', subject: COLLECTION_SUBJECT_REF(ALICE, RKEY_B) },
            { rkey: 'f4', subject: 'at://did:plc:alice/app.bsky.feed.post/3abc' },
          ],
        }),
      },
    )
    const page = await utils.listFollowedCollections(BOB, 10)
    expect(page.cursor).toBe('next')
    expect(page.items.map(c => c.name)).toEqual(['Parsers'])
  })
})

describe('CollectionsUtils.getCollectionsContaining', () => {
  it('hydrates backlinks, dedupes, and drops hidden or missing collections', async () => {
    const { utils, constellation } = setup(
      {
        [key(ALICE, RKEY_A)]: record('Alice', [PACKAGE_SUBJECT_REF('zod')]),
        [key(MALLORY, RKEY_A)]: record('Spam', [PACKAGE_SUBJECT_REF('zod')]),
      },
      {
        moderation: {
          getHiddenDids: async dids => new Set(dids.filter(did => did === MALLORY)),
          isHidden: async did => did === MALLORY,
        },
      },
    )
    constellation.getBackLinks.mockResolvedValue({
      data: {
        total: 4,
        cursor: 'next',
        records: [
          { did: ALICE, collection: 'dev.npmx.collection', rkey: RKEY_A },
          { did: ALICE, collection: 'dev.npmx.collection', rkey: RKEY_A },
          { did: MALLORY, collection: 'dev.npmx.collection', rkey: RKEY_A },
          { did: BOB, collection: 'dev.npmx.collection', rkey: RKEY_B },
        ],
      },
      isStale: false,
      cachedAt: null,
    })

    const result = await utils.getCollectionsContaining(PACKAGE_SUBJECT_REF('zod'), 10)

    expect(result.total).toBe(4)
    expect(result.cursor).toBe('next')
    expect(result.items.map(item => item.name)).toEqual(['Alice'])
    expect(constellation.getBackLinks).toHaveBeenCalledWith(
      PACKAGE_SUBJECT_REF('zod'),
      'dev.npmx.collection',
      'items[].subjectRef',
      10,
      undefined,
      false,
      [],
      0,
    )
  })
})

describe('CollectionsUtils.listUserCollections', () => {
  it('returns summaries with the record key', async () => {
    const { utils } = setup(
      {},
      {
        listRecords: async doc => ({
          cursor: 'c2',
          records: [
            {
              uri: COLLECTION_SUBJECT_REF(doc.did, RKEY_A),
              cid: 'cid',
              value: record('A', [PACKAGE_SUBJECT_REF('zod')]) as never,
            },
          ],
        }),
      },
    )
    const result = await utils.listUserCollections(ALICE, 20)
    expect(result).toEqual({
      cursor: 'c2',
      items: [expect.objectContaining({ rkey: RKEY_A, name: 'A', itemCount: 1, did: ALICE })],
    })
  })

  it('returns nothing for hidden accounts', async () => {
    const listRecords = vi.fn()
    const { utils } = setup(
      {},
      {
        listRecords,
        moderation: { getHiddenDids: async () => new Set([MALLORY]), isHidden: async () => true },
      },
    )
    expect(await utils.listUserCollections(MALLORY, 20)).toEqual({ items: [] })
    expect(listRecords).not.toHaveBeenCalled()
  })
})

const label = (val: string, extra: Record<string, unknown> = {}) => ({
  src: BLUESKY_MODERATION_DID,
  val,
  ...extra,
})

describe('AccountModerationUtils', () => {
  it('hides only on Bluesky moderation labels that hide accounts', () => {
    expect(isHiddenByLabels([label('spam')])).toBe(true)
    expect(isHiddenByLabels([label('!hide')])).toBe(true)
    expect(isHiddenByLabels([label('spam', { neg: true })])).toBe(false)
    expect(isHiddenByLabels([label('spam', { exp: '2000-01-01T00:00:00Z' })])).toBe(false)
    expect(isHiddenByLabels([{ src: 'did:plc:someone-else', val: 'spam' }])).toBe(false)
    expect(isHiddenByLabels([label('porn')])).toBe(false)
    expect(isHiddenByLabels(undefined)).toBe(false)
  })

  it('batches lookups, caches results, and fails open', async () => {
    const fetchProfileLabels = vi.fn(async (dids: string[]) =>
      dids.map(did => ({ did, labels: did === MALLORY ? [label('spam')] : [] })),
    )
    const utils = new AccountModerationUtils({ fetchProfileLabels, cache: memoryCache() })

    expect(await utils.getHiddenDids([ALICE, MALLORY, ALICE])).toEqual(new Set([MALLORY]))
    expect(await utils.isHidden(MALLORY)).toBe(true)
    expect(fetchProfileLabels).toHaveBeenCalledTimes(1)
    expect(fetchProfileLabels).toHaveBeenCalledWith([ALICE, MALLORY])

    const failing = new AccountModerationUtils({
      fetchProfileLabels: async () => Promise.reject(new Error('down')),
      cache: memoryCache(),
    })
    expect(await failing.getHiddenDids([MALLORY])).toEqual(new Set())
  })

  it('splits large lookups into batches of 25', async () => {
    const fetchProfileLabels = vi.fn(async (dids: string[]) => dids.map(did => ({ did })))
    const utils = new AccountModerationUtils({ fetchProfileLabels, cache: memoryCache() })
    await utils.getHiddenDids(Array.from({ length: 30 }, (_, i) => `did:plc:${i}`))
    expect(fetchProfileLabels.mock.calls.map(([dids]) => dids.length)).toEqual([25, 5])
  })
})

beforeEach(() => {
  vi.restoreAllMocks()
})
