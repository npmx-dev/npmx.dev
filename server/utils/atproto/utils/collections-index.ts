import { on } from 'node:events'
import { Redis } from '@upstash/redis'
import { createMemoryRedis, type IndexRedis } from './memory-redis'
import * as dev from '#shared/types/lexicons/dev'
import { parseSubjectRef } from '#shared/utils/collections'
import { COLLECTION_SUBJECT_REF } from '#shared/utils/constants'
import { toCollectionFields, type IndexedCollection, type Reaction } from './collections'

/**
 * A global index of dev.npmx.collection records, fed from Jetstream. Nothing else on the network
 * can enumerate every collection, so this is what powers browse. It is an accelerator, not a
 * source of truth: the PDS is, and gaps are acceptable.
 */

const JETSTREAM_URL =
  'wss://jetstream.us-east.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents'
const COLLECTION_NSID = dev.npmx.collection.$nsid
const LIKE_NSID = dev.npmx.feed.like.$nsid
const FOLLOW_NSID = dev.npmx.graph.follow.$nsid

const US_PER_MS = 1000
// First run only: Jetstream maps a timestamp cursor to a seq. Retention is about 36h, and an
// older cursor starts at the retention floor anyway.
export const INITIAL_LOOKBACK_US = 35 * 60 * 60 * 1000 * US_PER_MS
// Within this lag of now means we've caught up.
const CAUGHT_UP_LAG_US = 10 * 1000 * US_PER_MS
const CURSOR_SAVE_EVERY = 100
const MAX_EVENT_ATTEMPTS = 3

export type BrowseSort = 'recent' | 'liked' | 'followed'

// Rankings count distinct accounts, so one account can't stack records. Removing one of an
// account's duplicate records undercounts by one; that only costs the account doing it.
const authorOf = (recordKey: string) => recordKey.split('/')[0]!

const REACTION_SORT = { like: 'liked', follow: 'followed' } as const satisfies Record<
  Reaction,
  BrowseSort
>
const REACTIONS = Object.keys(REACTION_SORT) as Reaction[]

// Exported for tests, which check what's stored
export const KEY = {
  cursor: 'collections-index:cursor',
  failedEvent: 'collections-index:failed-event',
  sorted: (sort: BrowseSort) => `collections-index:${sort}`,
  item: (uri: string) => `collections-index:item:${uri}`,
  record: (reaction: Reaction, recordKey: string) => `collections-index:${reaction}:${recordKey}`,
  authors: (reaction: Reaction, uri: string) =>
    `collections-index:${reaction === 'like' ? 'likers' : 'followers'}:${uri}`,
}

/** Browse's index in Redis: an entry per collection plus a sorted set per sort order. */
export class CollectionsIndexStore {
  constructor(private readonly redis: IndexRedis) {}

  /** A Jetstream seq. */
  async getCursor() {
    return (await this.redis.get<number>(KEY.cursor)) ?? null
  }

  async setCursor(seq: number) {
    await this.redis.set(KEY.cursor, seq)
  }

  async clearCursor() {
    await this.redis.del(KEY.cursor)
  }

  /** How many runs in a row have failed to apply the event at `seq`, counting this one. */
  async recordFailedEvent(seq: number) {
    const last = await this.redis.get<{ seq: number; attempts: number }>(KEY.failedEvent)
    const attempts = last?.seq === seq ? last.attempts + 1 : 1
    await this.redis.set(KEY.failedEvent, { seq, attempts })
    return attempts
  }

  /** `firstSeenUs` only applies the first time a collection is seen, so edits don't bump it. */
  async upsertCollection(entry: IndexedCollection, firstSeenUs: number) {
    await Promise.all([
      this.redis.set(KEY.item(entry.uri), entry),
      this.redis.zadd(
        KEY.sorted('recent'),
        { nx: true },
        { score: firstSeenUs, member: entry.uri },
      ),
    ])
  }

  async removeCollection(uri: string) {
    await Promise.all([
      this.redis.del(KEY.item(uri)),
      this.redis.zrem(KEY.sorted('recent'), uri),
      ...REACTIONS.flatMap(reaction => [
        this.redis.zrem(KEY.sorted(REACTION_SORT[reaction]), uri),
        this.redis.del(KEY.authors(reaction, uri)),
      ]),
    ])
  }

  /**
   * `recordKey` is `<author did>/<record rkey>` of a like or follow. Ignored if the collection
   * isn't indexed (made-up URIs). Every step is idempotent, so a replay or a retry after a partial
   * failure converges.
   */
  async addReaction(reaction: Reaction, recordKey: string, subjectUri: string) {
    if (!(await this.redis.exists(KEY.item(subjectUri)))) return
    await this.redis.sadd(KEY.authors(reaction, subjectUri), authorOf(recordKey))
    await this.syncScore(reaction, subjectUri)
    // Last, so removeReaction never finds a record whose author wasn't counted
    await this.redis.set(KEY.record(reaction, recordKey), subjectUri)
  }

  async removeReaction(reaction: Reaction, recordKey: string) {
    const subjectUri = await this.redis.getdel<string>(KEY.record(reaction, recordKey))
    if (!subjectUri) return
    await this.redis.srem(KEY.authors(reaction, subjectUri), authorOf(recordKey))
    await this.syncScore(reaction, subjectUri)
  }

  // Set rather than incremented, so a lost or repeated update can't drift the score. Collections
  // nobody has liked or followed stay out, rather than filling those sorts in arbitrary order.
  private async syncScore(reaction: Reaction, uri: string) {
    const key = KEY.sorted(REACTION_SORT[reaction])
    const authors = await this.redis.scard(KEY.authors(reaction, uri))
    await (authors > 0
      ? this.redis.zadd(key, { score: authors, member: uri })
      : this.redis.zrem(key, uri))
  }

  /** `scanned` counts index slots read, including stale ones skipped, for paging. */
  async list(sort: BrowseSort, offset: number, limit: number) {
    const uris = await this.redis.zrange<string[]>(KEY.sorted(sort), offset, offset + limit - 1, {
      rev: true,
    })
    if (uris.length === 0) return { entries: [], scanned: 0 }
    const entries = await this.redis.mget<(IndexedCollection | null)[]>(...uris.map(KEY.item))
    return { entries: entries.filter(entry => entry !== null), scanned: uris.length }
  }
}

let localStore: CollectionsIndexStore | undefined

export function getCollectionsIndexStore(): CollectionsIndexStore {
  const config = useRuntimeConfig()
  if (!import.meta.dev && config.upstash?.redisRestUrl && config.upstash?.redisRestToken) {
    return new CollectionsIndexStore(
      new Redis({ url: config.upstash.redisRestUrl, token: config.upstash.redisRestToken }),
    )
  }
  return (localStore ??= new CollectionsIndexStore(createMemoryRedis()))
}

/** A Jetstream record as an index entry. Null if the record isn't a valid collection. */
function toIndexedCollection(
  did: string,
  rkey: string,
  cid: string | undefined,
  record: unknown,
): IndexedCollection | null {
  const result = dev.npmx.collection.$safeValidate(record)
  if (!result.success || !cid) return null
  return toCollectionFields(did, rkey, cid, result.value)
}

const EVENT_TYPE = 'network.bsky.jetstream.subscribeEvents'

/** A Jetstream v2 frame's `payload`. Commits carry their fields at the top level. */
export type JetstreamPayload = {
  $type: string
  seq?: number
  time?: string
  did?: string
  operation?: 'create' | 'update' | 'delete'
  collection?: string
  rkey?: string
  cid?: string
  record?: unknown
  name?: string
  message?: string
}

const payloadTimeUs = (payload: JetstreamPayload) =>
  payload.time ? Date.parse(payload.time) * US_PER_MS : Number.NaN

/** Applies one Jetstream event to the index. Idempotent, so replaying overlap is safe. */
export async function applyJetstreamEvent(store: CollectionsIndexStore, event: JetstreamPayload) {
  const { did, rkey, operation } = event
  if (event.$type !== `${EVENT_TYPE}#commit` || !did || !rkey || !operation) return

  if (event.collection === COLLECTION_NSID) {
    const uri = COLLECTION_SUBJECT_REF(did, rkey)
    const entry =
      operation === 'delete' ? null : toIndexedCollection(did, rkey, event.cid, event.record)
    const seenUs = payloadTimeUs(event)
    // An edit that made the record invalid should take it out of browse too
    if (entry) {
      await store.upsertCollection(entry, Number.isFinite(seenUs) ? seenUs : Date.now() * US_PER_MS)
    } else await store.removeCollection(uri)
    return
  }

  const reaction =
    event.collection === LIKE_NSID ? 'like' : event.collection === FOLLOW_NSID ? 'follow' : null
  if (!reaction) return
  const recordKey = `${did}/${rkey}`
  if (operation === 'delete') {
    await store.removeReaction(reaction, recordKey)
    return
  }
  if (operation !== 'create') return
  const subject =
    reaction === 'like'
      ? dev.npmx.feed.like.$safeValidate(event.record)
      : dev.npmx.graph.follow.$safeValidate(event.record)
  if (!subject.success) return
  const subjectUri =
    'subjectRef' in subject.value ? subject.value.subjectRef : subject.value.subject
  // Package likes are counted via Constellation; only collections matter here.
  if (parseSubjectRef(subjectUri)?.kind !== 'collection') return
  await store.addReaction(reaction, recordKey, subjectUri)
}

export type DrainResult = {
  events: number
  fromCursor: number
  toCursor: number
  caughtUp: boolean
}

export type DrainDeps = {
  store: CollectionsIndexStore
  /**
   * Opens Jetstream at `url` and yields raw messages, ending when `signal` aborts. Stopping
   * iteration must close it.
   */
  subscribe: (url: string, signal: AbortSignal) => AsyncIterable<string>
  nowUs?: () => number
  maxDurationMs?: number
}

/**
 * `identity` events (~15/min network-wide) are the clock. Replay scans history server-side and
 * sends nothing when nothing matches, so with commits alone a quiet stream could mean "caught up"
 * or "still scanning".
 */
function jetstreamUrl(cursor: number) {
  const params = new URLSearchParams([
    ['collections', COLLECTION_NSID],
    ['collections', LIKE_NSID],
    ['collections', FOLLOW_NSID],
    ['kinds', 'commit'],
    ['kinds', 'identity'],
    ['cursor', String(cursor)],
  ])
  return `${JETSTREAM_URL}?${params}`
}

/**
 * Replays Jetstream from the stored cursor until caught up or out of time, saving the cursor as
 * it goes so a run that times out still makes progress.
 */
export async function drainJetstream({
  store,
  subscribe,
  nowUs = () => Date.now() * US_PER_MS,
  // Replay runs at about an hour of history per second, so this covers Jetstream's whole
  // retention. Stays under the 300s function timeout, so the final cursor write runs, and
  // under the 5-minute cron interval, since nothing stops two runs from overlapping.
  maxDurationMs = 180_000,
}: DrainDeps): Promise<DrainResult> {
  const startedAt = nowUs()
  const deadline = startedAt + maxDurationMs * US_PER_MS
  const storedCursor = await store.getCursor()
  const fromCursor = storedCursor ?? startedAt - INITIAL_LOOKBACK_US

  let cursor = fromCursor
  let received = 0
  let events = 0
  let caughtUp = false

  // Ends the stream even if Jetstream goes quiet or never connects
  const signal = AbortSignal.timeout(maxDurationMs)
  for await (const message of subscribe(jetstreamUrl(fromCursor), signal)) {
    received++
    let payload: JetstreamPayload | undefined
    try {
      payload = JSON.parse(message)?.payload
    } catch {
      continue
    }
    if (!payload) continue
    if (payload.$type === `${EVENT_TYPE}#info`) {
      console.warn(`[collections-index] Jetstream ${payload.name}: ${payload.message}`)
      continue
    }
    try {
      await applyJetstreamEvent(store, payload)
    } catch (error) {
      const attempts =
        payload.seq == null ? MAX_EVENT_ATTEMPTS : await store.recordFailedEvent(payload.seq)
      console.error('[collections-index] Failed to apply event', payload.seq, attempts, error)
      // Stop and let the next run retry it, unless it keeps failing: then skip it, or it would
      // stall the index for good
      if (attempts < MAX_EVENT_ATTEMPTS) break
    }
    events++
    if (payload.seq != null) cursor = payload.seq
    if (events % CURSOR_SAVE_EVERY === 0) await store.setCursor(cursor)

    const now = nowUs()
    if (payloadTimeUs(payload) >= now - CAUGHT_UP_LAG_US) {
      caughtUp = true
      break
    }
    if (now >= deadline) break
  }

  // Not even the identity clock arrived, so Jetstream refused the connection. Most likely the
  // cursor is past retention (HTTP 400 CursorTooOld), which would fail every run: start over.
  if (received === 0 && storedCursor !== null) {
    await store.clearCursor()
    return { events, fromCursor, toCursor: fromCursor, caughtUp }
  }

  await store.setCursor(cursor)
  return { events, fromCursor, toCursor: cursor, caughtUp }
}

/** Jetstream's text messages until the socket closes or errors, or `signal` aborts. */
export async function* webSocketMessages(url: string, signal: AbortSignal): AsyncGenerator<string> {
  const socket = new WebSocket(url)
  socket.addEventListener('error', () => console.warn('[collections-index] Jetstream socket error'))
  try {
    for await (const [event] of on(socket, 'message', { close: ['close', 'error'], signal })) {
      yield String((event as MessageEvent).data)
    }
  } catch (error) {
    // Aborting is how a run ends on time, not a failure
    if (!signal.aborted) throw error
  } finally {
    socket.close()
  }
}
