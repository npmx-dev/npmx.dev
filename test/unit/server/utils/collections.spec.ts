import { describe, expect, it, vi } from 'vite-plus/test'
import type { CacheAdapter } from '#server/utils/cache/shared'
import type { MiniDoc } from '#shared/types/social'
import { COLLECTION_SUBJECT_REF, PACKAGE_SUBJECT_REF } from '#shared/utils/constants'

const { CollectionsUtils } = await import('#server/utils/atproto/utils/collections')

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
  const fetchRecord = vi.fn(async (doc: MiniDoc, rkey: string) => {
    const value = records[key(doc.did, rkey)]
    return value ? { uri: COLLECTION_SUBJECT_REF(doc.did, rkey), cid: `cid-${rkey}`, value } : null
  })
  const deps: Deps = {
    cache: memoryCache(),
    resolveIdentity: async identifier => miniDoc(identifier),
    fetchRecord,
    listRecords: async () => ({ records: [] }),
    packageExists: async name => name !== 'does-not-exist',
    ...overrides,
  }
  return { utils: new CollectionsUtils(deps), fetchRecord }
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

  it('marks unresolvable nested collections', async () => {
    const { utils } = setup({
      [key(ALICE, RKEY_A)]: record('A', [COLLECTION_SUBJECT_REF(BOB, RKEY_C)]),
    })

    const view = await utils.getCollection(ALICE, RKEY_A)

    expect(view?.items).toEqual([
      expect.objectContaining({ collection: null, unavailableReason: 'unresolvable' }),
    ])
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
})
