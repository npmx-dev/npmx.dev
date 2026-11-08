import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import * as v from 'valibot'
import { createError } from 'h3'
import type * as AtprotoLex from '@atproto/lex'
import { CollectionItemsChangeSchema } from '#shared/schemas/social'
import { MAX_COLLECTION_ITEMS, PACKAGE_SUBJECT_REF } from '#shared/utils/constants'

const OWNER = 'did:plc:owner'
const VIEWER = 'did:plc:viewer'
const RKEY = '3m5k5baifas2a'
const URI = `at://${OWNER}/dev.npmx.collection/${RKEY}`
const REF = { identifier: OWNER, rkey: RKEY }
const ZOD = PACKAGE_SUBJECT_REF('zod')
const VALIBOT = PACKAGE_SUBJECT_REF('valibot')

const client = { create: vi.fn(), put: vi.fn(), delete: vi.fn() }
vi.mock('@atproto/lex', async importOriginal => ({
  ...(await importOriginal<typeof AtprotoLex>()),
  Client: class {
    create = client.create
    put = client.put
    delete = client.delete
  },
}))
const throwOnMissingOAuthScope = vi.fn()
vi.mock('#server/utils/atproto/oauth', () => ({ throwOnMissingOAuthScope }))

const utils = {
  fetchRawRecord: vi.fn(),
  setStoredRecord: vi.fn(async () => {}),
  getStoredRecord: vi.fn(),
  getViewerReaction: vi.fn(),
  getReaction: vi.fn(),
  getReactionTotal: vi.fn(async () => 4),
  recordReaction: vi.fn(async () => ({ total: 1, viewerHas: true })),
  recordUnreaction: vi.fn(async () => ({ total: 0, viewerHas: false })),
}
vi.stubGlobal('createError', createError)
vi.stubGlobal(
  'IdentityUtils',
  class {
    getMiniDoc = async () => ({ did: OWNER, handle: 'owner.test', pds: 'https://pds.test' })
  },
)
// Called with `new`; returning an object makes that the instance
vi.stubGlobal('CollectionsUtils', function CollectionsUtils() {
  return utils
})

const writes = await import('#server/utils/atproto/utils/collection-writes')

const sessionFor = (did: string) => ({ did: { toString: () => did } }) as never
const stored = (cid: string, subjectRefs: string[], extra: Record<string, unknown> = {}) => ({
  uri: URI,
  cid,
  value: {
    $type: 'dev.npmx.collection',
    name: 'Validation',
    description: 'Old description',
    items: subjectRefs.map(subjectRef => ({ subjectRef, note: `why ${subjectRef}` })),
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  },
})
const swapError = () => Object.assign(new Error('swap'), { error: 'InvalidSwap' })

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
  utils.fetchRawRecord.mockResolvedValue(stored('cid-1', [ZOD]))
  utils.getStoredRecord.mockResolvedValue(stored('cid-1', [ZOD]))
  utils.getViewerReaction.mockResolvedValue(null)
  client.put.mockResolvedValue({ uri: URI, cid: 'cid-2' })
})

describe('updateCollection', () => {
  const body = {
    name: 'Parsers',
    items: [{ subjectRef: PACKAGE_SUBJECT_REF('commander'), note: 'default' }],
    cid: 'cid-1',
  }

  it('requires a session and the collections scope', async () => {
    await expect(writes.updateCollection(undefined, REF, body)).rejects.toMatchObject({
      statusCode: 401,
    })
    throwOnMissingOAuthScope.mockRejectedValueOnce(createError({ status: 403 }))
    await expect(writes.updateCollection(sessionFor(OWNER), REF, body)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(client.put).not.toHaveBeenCalled()
  })

  it("rejects editing someone else's collection", async () => {
    await expect(writes.updateCollection(sessionFor(VIEWER), REF, body)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(client.put).not.toHaveBeenCalled()
  })

  it('returns 409 when the editor started from a stale version', async () => {
    await expect(
      writes.updateCollection(sessionFor(OWNER), REF, { ...body, cid: 'cid-0' }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(client.put).not.toHaveBeenCalled()
  })

  it('returns 409 without retrying when the PDS rejects the swap', async () => {
    client.put.mockRejectedValueOnce(swapError())
    await expect(writes.updateCollection(sessionFor(OWNER), REF, body)).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(client.put).toHaveBeenCalledTimes(1)
  })

  it('writes with swapRecord, keeps createdAt and unknown fields, and caches the write', async () => {
    utils.fetchRawRecord.mockResolvedValue(
      stored('cid-1', [], { 'com.example.extension': { keep: true } }),
    )
    // The PDS's reported URI is ignored, so a hostile PDS can't claim another account's record
    client.put.mockResolvedValue({ uri: 'at://did:plc:victim/dev.npmx.collection/x', cid: 'cid-2' })

    expect(await writes.updateCollection(sessionFor(OWNER), REF, body)).toEqual({
      uri: URI,
      cid: 'cid-2',
      did: OWNER,
      rkey: RKEY,
    })
    const [, value, options] = client.put.mock.calls[0]!
    expect(options).toEqual({ rkey: RKEY, swapRecord: 'cid-1' })
    expect(value).toEqual({
      'com.example.extension': { keep: true },
      'name': 'Parsers',
      'items': [{ subjectRef: PACKAGE_SUBJECT_REF('commander'), note: 'default' }],
      'createdAt': '2026-01-01T00:00:00.000Z',
    })
    expect(utils.setStoredRecord).toHaveBeenCalledWith(OWNER, RKEY, {
      cid: 'cid-2',
      value: { $type: 'dev.npmx.collection', ...value },
    })
  })
})

const change = (add: string[], remove: string[] = []) =>
  writes.changeCollectionItems(sessionFor(OWNER), REF, { add, remove })
const parseChange = (body: unknown) => v.safeParse(CollectionItemsChangeSchema, body).success

describe('changeCollectionItems', () => {
  it("rejects editing someone else's collection", async () => {
    await expect(
      writes.changeCollectionItems(sessionFor(VIEWER), REF, { add: [VALIBOT], remove: [] }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('appends to the current record, keeping notes and unknown item fields', async () => {
    const record = stored('cid-1', [ZOD])
    record.value.items[0] = { ...record.value.items[0]!, 'com.example.rating': 5 } as never
    utils.fetchRawRecord.mockResolvedValue(record)

    expect(await change([VALIBOT])).toEqual({
      uri: URI,
      cid: 'cid-2',
      did: OWNER,
      rkey: RKEY,
      subjectRefs: [ZOD, VALIBOT],
    })
    const [, value, options] = client.put.mock.calls[0]!
    expect(options).toEqual({ rkey: RKEY, swapRecord: 'cid-1' })
    expect(value.items).toEqual([
      { 'subjectRef': ZOD, 'note': `why ${ZOD}`, 'com.example.rating': 5 },
      { subjectRef: VALIBOT },
    ])
  })

  it('retries a lost swap against the fresh record, so concurrent toggles both land', async () => {
    const ARKTYPE = PACKAGE_SUBJECT_REF('arktype')
    utils.fetchRawRecord
      .mockResolvedValueOnce(stored('cid-1', [ZOD]))
      .mockResolvedValueOnce(stored('cid-1b', [ZOD, ARKTYPE]))
    client.put.mockRejectedValueOnce(swapError())

    const result = await change([VALIBOT])

    expect(client.put.mock.calls[1]![2]).toEqual({ rkey: RKEY, swapRecord: 'cid-1b' })
    expect(result.subjectRefs).toEqual([ZOD, ARKTYPE, VALIBOT])
  })

  it('gives up with 409 after repeated lost swaps', async () => {
    client.put.mockRejectedValue(swapError())
    await expect(change([VALIBOT])).rejects.toMatchObject({ statusCode: 409 })
    expect(client.put).toHaveBeenCalledTimes(3)
  })

  it('refuses to overflow a full collection', async () => {
    const full = Array.from({ length: MAX_COLLECTION_ITEMS }, (_, i) =>
      PACKAGE_SUBJECT_REF(`pkg-${i}`),
    )
    utils.fetchRawRecord.mockResolvedValue(stored('cid-1', full))
    await expect(change([VALIBOT])).rejects.toMatchObject({ statusCode: 400 })
    expect(client.put).not.toHaveBeenCalled()
  })

  it('rejects changes npmx cannot render or that contradict themselves', () => {
    expect(parseChange({ add: ['https://example.com'] })).toBe(false)
    expect(parseChange({ add: [ZOD], remove: [ZOD] })).toBe(false)
  })
})

describe('setReaction', () => {
  it('follows with a follow record pointing at the collection', async () => {
    client.create.mockResolvedValue({ uri: `at://${VIEWER}/dev.npmx.graph.follow/3follow` })
    expect(await writes.setReaction(sessionFor(VIEWER), REF, 'follow', true)).toEqual({
      total: 1,
      viewerHas: true,
    })
    expect(throwOnMissingOAuthScope).toHaveBeenCalledWith(
      expect.anything(),
      'repo:dev.npmx.graph.follow',
    )
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({ $nsid: 'dev.npmx.graph.follow' }),
      expect.objectContaining({ subject: URI }),
    )
    expect(utils.recordReaction).toHaveBeenCalledWith('follow', URI, VIEWER, '3follow', 4)
  })

  it('likes via subjectRef', async () => {
    client.create.mockResolvedValue({ uri: `at://${VIEWER}/dev.npmx.feed.like/3like` })
    await writes.setReaction(sessionFor(VIEWER), REF, 'like', true)
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({ $nsid: 'dev.npmx.feed.like' }),
      expect.objectContaining({ subjectRef: URI }),
    )
  })

  it('writes nothing when already in the requested state', async () => {
    utils.getReaction.mockResolvedValue({ total: 5, viewerHas: false })
    expect(await writes.setReaction(sessionFor(VIEWER), REF, 'follow', false)).toEqual({
      total: 5,
      viewerHas: false,
    })
    expect(client.create).not.toHaveBeenCalled()
    expect(client.delete).not.toHaveBeenCalled()
  })

  it('unfollows by deleting the viewer’s follow record', async () => {
    utils.getViewerReaction.mockResolvedValue({
      did: VIEWER,
      collection: 'dev.npmx.graph.follow',
      rkey: '3follow',
    })
    await writes.setReaction(sessionFor(VIEWER), REF, 'follow', false)
    expect(client.delete).toHaveBeenCalledWith(
      expect.objectContaining({ $nsid: 'dev.npmx.graph.follow' }),
      { rkey: '3follow' },
    )
    expect(utils.recordUnreaction).toHaveBeenCalledWith('follow', URI, VIEWER, 4)
  })

  it('refuses to follow your own collection', async () => {
    await expect(writes.setReaction(sessionFor(OWNER), REF, 'follow', true)).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(client.create).not.toHaveBeenCalled()
  })

  it('refuses to follow a collection that does not exist', async () => {
    utils.getStoredRecord.mockResolvedValue(null)
    await expect(writes.setReaction(sessionFor(VIEWER), REF, 'follow', true)).rejects.toMatchObject(
      { statusCode: 404 },
    )
    expect(client.create).not.toHaveBeenCalled()
  })
})

describe('buildCollectionRecord', () => {
  it('stamps createdAt for new records and omits empty optional fields', () => {
    expect(
      writes.buildCollectionRecord({ name: 'x', description: '', items: [{ subjectRef: ZOD }] }),
    ).toEqual({ name: 'x', items: [{ subjectRef: ZOD }], createdAt: expect.any(String) })
  })

  it('replaces an invalid existing createdAt', () => {
    const record = writes.buildCollectionRecord({ name: 'x', items: [] }, { createdAt: 'nope' })
    expect(record.createdAt).not.toBe('nope')
  })
})

describe('applyItemChanges', () => {
  it('removes, then appends only what is missing', () => {
    const items = [{ subjectRef: ZOD, note: 'n' }, { subjectRef: VALIBOT }]
    expect(writes.applyItemChanges(items, [ZOD, 'x', 'x'], [VALIBOT])).toEqual([
      { subjectRef: ZOD, note: 'n' },
      { subjectRef: 'x' },
    ])
  })
})
