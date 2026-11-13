import { Client } from '@atproto/lex'
import * as com from '#shared/types/lexicons/com'
import * as dev from '#shared/types/lexicons/dev'
import type {
  CollectionItemView,
  CollectionSummary,
  CollectionUnavailableReason,
  CollectionView,
  MiniDoc,
  OwnCollection,
  ReactionState,
} from '#shared/types/social'
import { parseSubjectRef } from '#shared/utils/collections'
import { mapWithConcurrency } from '#shared/utils/async'
import { CACHE_MAX_AGE_ONE_MINUTE, COLLECTION_SUBJECT_REF } from '#shared/utils/constants'
import type { Backlink, Constellation } from '#shared/utils/constellation'

const HEADERS = { 'User-Agent': 'npmx' }
const COLLECTION_NSID = dev.npmx.collection.$nsid

// Records that point at a collection and are counted once per account.
const REACTIONS = {
  like: { nsid: dev.npmx.feed.like.$nsid, path: 'subjectRef' },
  follow: { nsid: dev.npmx.graph.follow.$nsid, path: 'subject' },
} as const
export type Reaction = keyof typeof REACTIONS

const CACHE_PREFIX = 'atproto-collections:'
const CACHE_RECORD_KEY = (did: string, rkey: string) => `${CACHE_PREFIX}${did}:${rkey}:record`
const CACHE_REACTION_TOTAL_KEY = (reaction: Reaction, uri: string) =>
  `${CACHE_PREFIX}${uri}:${reaction}:total`
const CACHE_VIEWER_REACTION_KEY = (reaction: Reaction, uri: string, did: string) =>
  `${CACHE_PREFIX}${uri}:${reaction}:${did}`
const CACHE_MAX_AGE = CACHE_MAX_AGE_ONE_MINUTE * 5

// The owner's PDS is whatever their DID doc says, so it may be slow or hostile.
const PDS_TIMEOUT_MS = 5_000
const RESOLVE_CONCURRENCY = 16

export type StoredRecord = { uri: string; cid: string; value: dev.npmx.collection.Main }

export type CollectionsDeps = {
  constellation: Pick<Constellation, 'getBackLinks' | 'getLinksDistinctDids'>
  cache: CacheAdapter
  resolveIdentity: (identifier: string) => Promise<MiniDoc>
  /** Raw record from the owner's PDS, or null when it doesn't exist. Not yet validated. */
  fetchRecord: (
    miniDoc: MiniDoc,
    rkey: string,
  ) => Promise<{ uri: string; cid: string; value: unknown } | null>
  listRecords: (
    miniDoc: MiniDoc,
    limit: number,
    cursor?: string,
  ) => Promise<{ cursor?: string; records: StoredRecord[] }>
  /** The account's follow records, with subjects not yet validated. */
  listFollows: (
    miniDoc: MiniDoc,
    limit: number,
    cursor?: string,
  ) => Promise<{ cursor?: string; records: { rkey: string; subject: string }[] }>
  packageExists: (packageName: string) => Promise<boolean>
}

type IndexedCollection = Omit<CollectionSummary, 'handle'>

/** A record's listing fields, as browse indexes them and summaries show them. */
function toCollectionFields(
  did: string,
  rkey: string,
  cid: string,
  value: dev.npmx.collection.Main,
): IndexedCollection {
  return {
    uri: COLLECTION_SUBJECT_REF(did, rkey),
    cid,
    did,
    rkey,
    name: value.name,
    description: value.description,
    itemCount: value.items.length,
    createdAt: value.createdAt,
  }
}

export type Paginated<T> = { cursor?: string; total?: number; items: T[] }

function toSummary(miniDoc: MiniDoc, rkey: string, stored: StoredRecord): CollectionSummary {
  return {
    ...toCollectionFields(miniDoc.did, rkey, stored.cid, stored.value),
    handle: miniDoc.handle,
  }
}

function defaultDeps(): CollectionsDeps {
  const identity = new IdentityUtils()
  return {
    // CollectionsUtils caches what it needs
    constellation: createUncachedConstellation(),
    cache: getCacheAdapter('generic'),
    resolveIdentity: identifier => identity.getMiniDoc(identifier) as Promise<MiniDoc>,
    fetchRecord: async (miniDoc, rkey) => {
      const client = new Client(miniDoc.pds, { headers: HEADERS })
      const response = await client.xrpcSafe(com.atproto.repo.getRecord, {
        params: {
          repo: miniDoc.did as `did:${string}:${string}`,
          collection: COLLECTION_NSID,
          rkey,
        },
        signal: AbortSignal.timeout(PDS_TIMEOUT_MS),
      })
      if (response.success) {
        const { uri, cid, value } = response.body
        return cid ? { uri, cid, value } : null
      }
      if (response.error === 'RecordNotFound') return null
      throw createError({ status: 502, message: `Failed to fetch collection from PDS` })
    },
    listRecords: async (miniDoc, limit, cursor) => {
      const client = new Client(miniDoc.pds, { headers: HEADERS })
      const result = await client.list(dev.npmx.collection, {
        repo: miniDoc.did as `did:${string}:${string}`,
        limit,
        cursor,
        signal: AbortSignal.timeout(PDS_TIMEOUT_MS),
      })
      return {
        cursor: result.cursor,
        // Invalid records come from other clients; skip them rather than fail the list
        records: result.records.flatMap(record => {
          const rkey = record.uri.split('/').pop()
          if (!record.valid || !rkey) return []
          const uri = COLLECTION_SUBJECT_REF(miniDoc.did, rkey)
          return [{ uri, cid: record.cid, value: record.value }]
        }),
      }
    },
    listFollows: async (miniDoc, limit, cursor) => {
      const client = new Client(miniDoc.pds, { headers: HEADERS })
      const result = await client.list(dev.npmx.graph.follow, {
        repo: miniDoc.did as `did:${string}:${string}`,
        limit,
        cursor,
        signal: AbortSignal.timeout(PDS_TIMEOUT_MS),
      })
      return {
        cursor: result.cursor,
        records: result.records.flatMap(record => {
          const rkey = record.uri.split('/').pop()
          return record.valid && rkey ? [{ rkey, subject: record.value.subject }] : []
        }),
      }
    },
    packageExists: name => fetchNpmPackageExists(name),
  }
}

/**
 * Reads dev.npmx.collection records from any PDS and resolves them into views.
 * Every record is untrusted: it may come from any client, so it is validated on read.
 */
export class CollectionsUtils {
  private readonly deps: CollectionsDeps

  constructor(deps?: CollectionsDeps) {
    this.deps = deps ?? defaultDeps()
  }

  // Wrapped in an object: RedisCacheAdapter treats falsy values (null, 0, false) as misses
  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = await this.deps.cache.get<{ value: T }>(key)
    if (hit) return hit.value
    const value = await load()
    await this.setCached(key, value)
    return value
  }

  private async setCached<T>(key: string, value: T) {
    await this.deps.cache.set(key, { value }, CACHE_MAX_AGE)
  }

  /** Validated record from cache or the owner's PDS; null when missing or invalid. */
  getStoredRecord(miniDoc: MiniDoc, rkey: string): Promise<StoredRecord | null> {
    return this.cached(CACHE_RECORD_KEY(miniDoc.did, rkey), async () => {
      const raw = await this.deps.fetchRecord(miniDoc, rkey)
      const result = raw && dev.npmx.collection.$safeValidate(raw.value)
      if (!raw || !result?.success) return null
      // Not `raw.uri`: a hostile PDS could claim another account's collection
      return { uri: COLLECTION_SUBJECT_REF(miniDoc.did, rkey), cid: raw.cid, value: result.value }
    })
  }

  /** Unvalidated record straight from the PDS, bypassing the cache. For read-modify-write. */
  async fetchRawRecord(miniDoc: MiniDoc, rkey: string) {
    return await this.deps.fetchRecord(miniDoc, rkey)
  }

  /** Call after writing a record so the next read sees it. */
  async setStoredRecord(did: string, rkey: string, stored: Omit<StoredRecord, 'uri'> | null) {
    // Built here, not taken from the PDS's write response, for the same reason as on read
    const record = stored && { ...stored, uri: COLLECTION_SUBJECT_REF(did, rkey) }
    await this.setCached(CACHE_RECORD_KEY(did, rkey), record)
  }

  async getCollection(
    identifier: string,
    rkey: string,
    viewerDid?: string,
  ): Promise<CollectionView | null> {
    const miniDoc = await this.deps.resolveIdentity(identifier)
    const stored = await this.getStoredRecord(miniDoc, rkey)
    if (!stored) return null

    const [items, likes, follows] = await Promise.all([
      mapWithConcurrency(
        stored.value.items,
        item => this.resolveItem(item.subjectRef, item.note),
        RESOLVE_CONCURRENCY,
      ),
      this.getReaction('like', stored.uri, viewerDid),
      this.getReaction('follow', stored.uri, viewerDid),
    ])
    return { ...toSummary(miniDoc, rkey, stored), items, likes, follows }
  }

  async getReaction(reaction: Reaction, uri: string, viewerDid?: string): Promise<ReactionState> {
    const [total, viewerRecord] = await Promise.all([
      this.getReactionTotal(reaction, uri),
      viewerDid ? this.getViewerReaction(reaction, uri, viewerDid) : null,
    ])
    return { total, viewerHas: viewerRecord !== null }
  }

  getReactionTotal(reaction: Reaction, uri: string): Promise<number> {
    const { nsid, path } = REACTIONS[reaction]
    return this.cached(CACHE_REACTION_TOTAL_KEY(reaction, uri), async () => {
      const { data } = await this.deps.constellation.getLinksDistinctDids(
        uri,
        nsid,
        `.${path}`,
        1,
        undefined,
        0,
      )
      return data.total
    })
  }

  /** The viewer's like or follow record for a collection, or null. */
  getViewerReaction(reaction: Reaction, uri: string, viewerDid: string): Promise<Backlink | null> {
    const { nsid, path } = REACTIONS[reaction]
    return this.cached(CACHE_VIEWER_REACTION_KEY(reaction, uri, viewerDid), async () => {
      const { data } = await this.deps.constellation.getBackLinks(
        uri,
        nsid,
        path,
        1,
        undefined,
        false,
        [[viewerDid]],
        0,
      )
      return data.records[0] ?? null
    })
  }

  // Constellation takes a few seconds to see a new record, so writes update the cache directly,
  // as PackageLikesUtils does for packages. `totalBefore` must be read before the PDS write, or a
  // refresh that already saw it would be counted twice.
  async recordReaction(
    reaction: Reaction,
    uri: string,
    viewerDid: string,
    rkey: string,
    totalBefore: number,
  ): Promise<ReactionState> {
    const backlink: Backlink = { did: viewerDid, collection: REACTIONS[reaction].nsid, rkey }
    const total = totalBefore + 1
    await Promise.all([
      this.setCached(CACHE_VIEWER_REACTION_KEY(reaction, uri, viewerDid), backlink),
      this.setCached(CACHE_REACTION_TOTAL_KEY(reaction, uri), total),
    ])
    return { total, viewerHas: true }
  }

  async recordUnreaction(
    reaction: Reaction,
    uri: string,
    viewerDid: string,
    totalBefore: number,
  ): Promise<ReactionState> {
    const total = Math.max(totalBefore - 1, 0)
    await Promise.all([
      this.setCached(CACHE_VIEWER_REACTION_KEY(reaction, uri, viewerDid), null),
      this.setCached(CACHE_REACTION_TOTAL_KEY(reaction, uri), total),
    ])
    return { total, viewerHas: false }
  }

  // Included collections resolve to a summary, not their items, so a view's work is bounded by
  // its own item count with no recursion, depth limit or cycle detection.
  private async resolveItem(
    subjectRef: string,
    note: string | undefined,
  ): Promise<CollectionItemView> {
    const subject = parseSubjectRef(subjectRef)
    if (!subject) return { kind: 'unknown', subjectRef, note }

    if (subject.kind === 'package') {
      // Optimistic on registry errors: a flaky registry shouldn't grey out a whole collection
      const resolved = await this.deps.packageExists(subject.packageName).catch(() => true)
      return { kind: 'package', subjectRef, note, packageName: subject.packageName, resolved }
    }

    const unavailable = (unavailableReason: CollectionUnavailableReason) =>
      ({ kind: 'collection', subjectRef, note, collection: null, unavailableReason }) as const
    try {
      const miniDoc = await this.deps.resolveIdentity(subject.did)
      const stored = await this.getStoredRecord(miniDoc, subject.rkey)
      if (!stored) return unavailable('unresolvable')
      return {
        kind: 'collection',
        subjectRef,
        note,
        collection: toSummary(miniDoc, subject.rkey, stored),
      }
    } catch {
      return unavailable('unresolvable')
    }
  }

  async listUserCollections(
    identifier: string,
    limit: number,
    cursor?: string,
  ): Promise<Paginated<CollectionSummary>> {
    const miniDoc = await this.deps.resolveIdentity(identifier)
    const { cursor: nextCursor, records } = await this.deps.listRecords(miniDoc, limit, cursor)
    return {
      cursor: nextCursor,
      items: records.map(record => toSummary(miniDoc, record.uri.split('/').pop()!, record)),
    }
  }

  /** The first 100 of a user's collections with their items, straight from their PDS. */
  async listOwnCollections(did: string): Promise<OwnCollection[]> {
    const miniDoc = await this.deps.resolveIdentity(did)
    const { records } = await this.deps.listRecords(miniDoc, 100)
    return records.map(record =>
      Object.assign(toSummary(miniDoc, record.uri.split('/').pop()!, record), {
        subjectRefs: record.value.items.map(item => item.subjectRef),
      }),
    )
  }

  /** Collections the account follows, newest follow first. Unresolvable subjects are dropped. */
  async listFollowedCollections(
    identifier: string,
    limit: number,
    cursor?: string,
  ): Promise<Paginated<CollectionSummary>> {
    const miniDoc = await this.deps.resolveIdentity(identifier)
    const { cursor: nextCursor, records } = await this.deps.listFollows(miniDoc, limit, cursor)
    const subjects = new Map<string, { did: string; rkey: string }>()
    for (const record of records) {
      const subject = parseSubjectRef(record.subject)
      if (subject?.kind === 'collection') subjects.set(subject.uri, subject)
    }
    return {
      cursor: nextCursor,
      items: await this.hydrate([...subjects.values()], async (owner, subject) => {
        const stored = await this.getStoredRecord(owner, subject.rkey)
        return stored && toSummary(owner, subject.rkey, stored)
      }),
    }
  }

  /**
   * Turns entries into summaries via `build`, dropping any entry whose author no longer resolves
   * (deleted, deactivated) or that `build` rejects.
   */
  async hydrate<T extends { did: string }>(
    entries: T[],
    build: (miniDoc: MiniDoc, entry: T) => Promise<CollectionSummary | null> | CollectionSummary,
  ): Promise<CollectionSummary[]> {
    const summaries = await Promise.all(
      entries.map(async entry => {
        try {
          return await build(await this.deps.resolveIdentity(entry.did), entry)
        } catch {
          return null
        }
      }),
    )
    return summaries.filter(summary => summary !== null)
  }
}
