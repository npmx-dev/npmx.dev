import { describe, expect, it, vi } from 'vite-plus/test'
import { COLLECTION_SUBJECT_REF, PACKAGE_SUBJECT_REF } from '#shared/utils/constants'

const { CollectionsIndexStore, KEY, applyJetstreamEvent, drainJetstream, INITIAL_LOOKBACK_US } =
  await import('#server/utils/atproto/utils/collections-index')
const { createMemoryRedis } = await import('#server/utils/atproto/utils/memory-redis')

// The store under test, on the in-memory Redis that local dev also uses
let redis = createMemoryRedis()
async function newStore(cursor?: number) {
  redis = createMemoryRedis()
  const store = new CollectionsIndexStore(redis)
  if (cursor !== undefined) await store.setCursor(cursor)
  return store
}
const likers = async (uri: string) => (await redis.smembers(KEY.authors('like', uri))).sort()
const followers = async (uri: string) => (await redis.smembers(KEY.authors('follow', uri))).sort()

const ALICE = 'did:plc:alice'
const BOB = 'did:plc:bob'
const RKEY_A = '3m5k5baifas2a'
const RKEY_B = '3m5k5baifas2b'
const A = COLLECTION_SUBJECT_REF(ALICE, RKEY_A)
const B = COLLECTION_SUBJECT_REF(ALICE, RKEY_B)

const collectionRecord = (name: string, items = 1) => ({
  $type: 'dev.npmx.collection',
  name,
  items: Array.from({ length: items }, () => ({ subjectRef: PACKAGE_SUBJECT_REF('zod') })),
  createdAt: '2026-11-01T00:00:00.000Z',
})

const TYPE = 'network.bsky.jetstream.subscribeEvents'
// `seq` doubles as the event time in µs, which keeps fixtures readable. Jetstream times have µs
// precision but Date only ms, so fixtures that care about order step by at least 1000.
const timeOf = (seq: number) => new Date(seq / 1000).toISOString()

const commit = (
  did: string,
  seq: number,
  collection: string,
  operation: 'create' | 'update' | 'delete',
  rkey: string,
  record?: unknown,
) => ({
  $type: `${TYPE}#commit`,
  did,
  seq,
  time: timeOf(seq),
  operation,
  collection,
  rkey,
  ...(operation === 'delete' ? {} : { cid: `cid-${seq}`, record }),
})

const identity = (did: string, seq: number) => ({
  $type: `${TYPE}#identity`,
  did,
  seq,
  time: timeOf(seq),
  identity: { did },
})

const likeOf = (subjectRef: string) => ({
  $type: 'dev.npmx.feed.like',
  subjectRef,
  createdAt: '2026-11-01T00:00:00.000Z',
})

const followOf = (subject: string) => ({
  $type: 'dev.npmx.graph.follow',
  subject,
  createdAt: '2026-11-01T00:00:00.000Z',
})

// Shaped like real Jetstream v2 payloads, including the identity events used as a clock
const fixture = [
  identity(BOB, 1_000),
  commit(ALICE, 2_000, 'dev.npmx.collection', 'create', RKEY_A, collectionRecord('Parsers', 2)),
  commit(ALICE, 3_000, 'dev.npmx.collection', 'create', RKEY_B, collectionRecord('Bundlers')),
  commit(BOB, 4_000, 'dev.npmx.feed.like', 'create', 'like1', likeOf(A)),
  commit(BOB, 5_000, 'dev.npmx.feed.like', 'create', 'like2', likeOf(PACKAGE_SUBJECT_REF('zod'))),
  commit(ALICE, 6_000, 'dev.npmx.collection', 'update', RKEY_A, collectionRecord('Arg parsers', 3)),
  identity(BOB, 7_000),
  commit(ALICE, 8_000, 'dev.npmx.feed.like', 'create', 'like3', likeOf(A)),
  commit(BOB, 9_000, 'dev.npmx.feed.like', 'delete', 'like1'),
  commit(ALICE, 10_000, 'dev.npmx.collection', 'create', 'bad', { name: 'missing items' }),
  commit(BOB, 11_000, 'dev.npmx.feed.like', 'create', 'like4', likeOf(B)),
  commit(ALICE, 12_000, 'dev.npmx.collection', 'delete', RKEY_B),
]

async function names(
  store: InstanceType<typeof CollectionsIndexStore>,
  sort: 'recent' | 'liked' | 'followed',
  offset = 0,
) {
  return (await store.list(sort, offset, 10)).entries.map(c => c.name)
}

async function applyAll(events: unknown[]) {
  const store = await newStore()
  for (const event of events) await applyJetstreamEvent(store, event as never)
  return store
}

describe('applyJetstreamEvent', () => {
  it('builds the index from a stream of events', async () => {
    const store = await applyAll(fixture)

    expect((await store.list('recent', 0, 10)).entries).toEqual([
      {
        uri: A,
        cid: 'cid-6000',
        did: ALICE,
        rkey: RKEY_A,
        name: 'Arg parsers',
        description: undefined,
        itemCount: 3,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ])
    // like1 removed, like3 kept; package likes and likes of deleted collections don't count
    expect(await likers(A)).toEqual([ALICE])
    expect(await redis.exists(KEY.record('like', `${BOB}/like2`))).toBe(0)
  })

  it('keeps first-seen order on edit', async () => {
    const store = await applyAll(fixture.slice(0, 6))
    expect(await names(store, 'recent')).toEqual(['Bundlers', 'Arg parsers'])
  })

  it('is idempotent under replay', async () => {
    const store = await applyAll([...fixture, ...fixture])
    expect(await likers(A)).toEqual([ALICE])
    expect(await names(store, 'recent')).toEqual(['Arg parsers'])
  })

  it('drops a collection whose edit makes it invalid', async () => {
    const store = await applyAll([
      fixture[1],
      commit(ALICE, 20_000, 'dev.npmx.collection', 'update', RKEY_A, { name: 'broken' }),
    ])
    expect(await names(store, 'recent')).toEqual([])
  })

  it('sorts by likes', async () => {
    const store = await applyAll([
      fixture[1],
      fixture[2],
      commit(BOB, 30_000, 'dev.npmx.feed.like', 'create', 'l1', likeOf(B)),
      commit(ALICE, 31_000, 'dev.npmx.feed.like', 'create', 'l2', likeOf(B)),
      commit(BOB, 32_000, 'dev.npmx.feed.like', 'create', 'l3', likeOf(A)),
    ])
    expect(await names(store, 'liked')).toEqual(['Bundlers', 'Parsers'])
    expect(await names(store, 'liked', 1)).toEqual(['Parsers'])
  })

  it('counts each account once, however many like records it makes', async () => {
    const store = await applyAll([
      fixture[1],
      fixture[2],
      ...Array.from({ length: 5 }, (_, i) =>
        commit(BOB, 30_000 + i, 'dev.npmx.feed.like', 'create', `spam${i}`, likeOf(A)),
      ),
      commit(BOB, 40_000, 'dev.npmx.feed.like', 'create', 'l1', likeOf(B)),
      commit(ALICE, 41_000, 'dev.npmx.feed.like', 'create', 'l2', likeOf(B)),
    ])
    expect(await names(store, 'liked')).toEqual(['Bundlers', 'Parsers'])
  })

  it('ranks by distinct followers, separately from likes', async () => {
    const store = await applyAll([
      fixture[1],
      fixture[2],
      commit(BOB, 30_000, 'dev.npmx.graph.follow', 'create', 'f1', followOf(A)),
      commit(BOB, 31_000, 'dev.npmx.graph.follow', 'create', 'f2', followOf(A)),
      commit(ALICE, 32_000, 'dev.npmx.graph.follow', 'create', 'f3', followOf(A)),
      commit(BOB, 33_000, 'dev.npmx.graph.follow', 'create', 'f4', followOf(B)),
      commit(ALICE, 34_000, 'dev.npmx.graph.follow', 'create', 'f5', followOf(B)),
      commit(ALICE, 35_000, 'dev.npmx.graph.follow', 'delete', 'f5'),
      commit(ALICE, 36_000, 'dev.npmx.graph.follow', 'create', 'bad', { subject: 'nope' }),
      commit(ALICE, 37_000, 'dev.npmx.feed.like', 'create', 'l1', likeOf(B)),
    ])
    expect(await followers(A)).toEqual([ALICE, BOB])
    expect(await followers(B)).toEqual([BOB])
    expect(await names(store, 'followed')).toEqual(['Parsers', 'Bundlers'])
    // Unliked collections stay out of the liked sort
    expect(await names(store, 'liked')).toEqual(['Bundlers'])
  })

  it('ignores likes of collections it has not indexed', async () => {
    const madeUp = COLLECTION_SUBJECT_REF(BOB, '3m5k5baifasz')
    const store = await applyAll([
      commit(BOB, 30_000, 'dev.npmx.feed.like', 'create', 'l1', likeOf(madeUp)),
    ])
    expect(await redis.exists(KEY.record('like', `${BOB}/l1`))).toBe(0)
    expect(await names(store, 'liked')).toEqual([])
  })
})

async function* messages(events: unknown[], onDone?: () => void) {
  try {
    for (const payload of events) yield JSON.stringify({ $type: 'message', payload })
  } finally {
    onDone?.()
  }
}

describe('drainJetstream', () => {
  const NOW = 2_000_000_000_000_000

  it('starts a first run from a timestamp cursor within the lookback', async () => {
    const store = await newStore()
    const subscribe = vi.fn((_url: string) => messages([]))

    const result = await drainJetstream({ store, subscribe, nowUs: () => NOW })

    const url = new URL(subscribe.mock.calls[0]![0])
    expect(result.fromCursor).toBe(NOW - INITIAL_LOOKBACK_US)
    expect(url.searchParams.get('cursor')).toBe(String(NOW - INITIAL_LOOKBACK_US))
    expect(url.searchParams.getAll('collections')).toEqual([
      'dev.npmx.collection',
      'dev.npmx.feed.like',
      'dev.npmx.graph.follow',
    ])
    expect(url.searchParams.getAll('kinds')).toEqual(['commit', 'identity'])
    expect(await store.getCursor()).toBe(NOW - INITIAL_LOOKBACK_US)
  })

  it('skips info frames', async () => {
    const store = await newStore(5)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await drainJetstream({
      store,
      subscribe: () =>
        messages([
          { $type: `${TYPE}#info`, name: 'OutdatedCursor', message: 'starting at seq 9' },
          identity(BOB, NOW),
        ]),
      nowUs: () => NOW,
    })

    expect(warn).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ events: 1, toCursor: NOW, caughtUp: true })
  })

  it('resumes from the stored cursor and stops once caught up', async () => {
    const store = await newStore(NOW - 60_000_000)
    let closed = false
    const events = [
      commit(
        ALICE,
        NOW - 50_000_000,
        'dev.npmx.collection',
        'create',
        RKEY_A,
        collectionRecord('A'),
      ),
      identity(BOB, NOW - 1_000_000),
      commit(ALICE, NOW, 'dev.npmx.collection', 'create', RKEY_B, collectionRecord('never read')),
    ]

    const result = await drainJetstream({
      store,
      subscribe: () => messages(events, () => (closed = true)),
      nowUs: () => NOW,
    })

    expect(result).toEqual({
      events: 2,
      fromCursor: NOW - 60_000_000,
      toCursor: NOW - 1_000_000,
      caughtUp: true,
    })
    expect(closed).toBe(true)
    expect(await store.getCursor()).toBe(NOW - 1_000_000)
    expect(await names(store, 'recent')).toEqual(['A'])
  })

  it('stops at the deadline with progress saved', async () => {
    const store = await newStore(NOW - 3_600_000_000)
    let now = NOW
    const events = Array.from({ length: 5 }, (_, i) => identity(BOB, NOW - 3_000_000_000 + i))

    const result = await drainJetstream({
      store,
      subscribe: () => messages(events),
      nowUs: () => (now += 20_000_000),
      maxDurationMs: 45_000,
    })

    expect(result.caughtUp).toBe(false)
    // Clock reads: start (+20s, deadline +65s), then +40s, +60s, +80s → stops after the third
    expect(result.events).toBe(3)
    expect(await store.getCursor()).toBe(NOW - 3_000_000_000 + 2)
  })

  it('does not advance past an event it failed to apply', async () => {
    const store = await newStore(NOW - 60_000_000)
    vi.spyOn(store, 'upsertCollection').mockRejectedValueOnce(new Error('redis down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await drainJetstream({
      store,
      subscribe: () =>
        messages([
          identity(BOB, NOW - 50_000_000),
          commit(
            ALICE,
            NOW - 40_000_000,
            'dev.npmx.collection',
            'create',
            RKEY_A,
            collectionRecord('A'),
          ),
        ]),
      nowUs: () => NOW,
    })

    expect(result.toCursor).toBe(NOW - 50_000_000)
    expect(await store.getCursor()).toBe(NOW - 50_000_000)
  })

  it("retries a failing event on later runs, then skips it so it can't stall the index", async () => {
    const store = await newStore(NOW - 60_000_000)
    vi.spyOn(store, 'upsertCollection').mockRejectedValue(new Error('bad event'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const run = () =>
      drainJetstream({
        store,
        subscribe: () =>
          messages([
            commit(
              ALICE,
              NOW - 50_000_000,
              'dev.npmx.collection',
              'create',
              RKEY_A,
              collectionRecord('A'),
            ),
            identity(BOB, NOW - 40_000_000),
          ]),
        nowUs: () => NOW,
      })

    expect((await run()).toCursor).toBe(NOW - 60_000_000)
    expect((await run()).toCursor).toBe(NOW - 60_000_000)
    expect((await run()).toCursor).toBe(NOW - 40_000_000)
  })

  it('starts over from the lookback when Jetstream sends nothing, e.g. a cursor past retention', async () => {
    const store = await newStore(7)

    const result = await drainJetstream({
      store,
      subscribe: async function* (_url, signal) {
        await new Promise(resolve => signal.addEventListener('abort', resolve))
        yield* []
      },
      maxDurationMs: 20,
    })

    expect(result).toMatchObject({ events: 0, toCursor: 7, caughtUp: false })
    expect(await store.getCursor()).toBeNull()
  })
})
