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
} from '#shared/types/social'
import { parseSubjectRef } from '#shared/utils/collections'
import { mapWithConcurrency } from '#shared/utils/async'
import { CACHE_MAX_AGE_ONE_MINUTE, COLLECTION_SUBJECT_REF } from '#shared/utils/constants'

const HEADERS = { 'User-Agent': 'npmx' }
const COLLECTION_NSID = dev.npmx.collection.$nsid

const CACHE_PREFIX = 'atproto-collections:'
const CACHE_RECORD_KEY = (did: string, rkey: string) => `${CACHE_PREFIX}${did}:${rkey}:record`
const CACHE_MAX_AGE = CACHE_MAX_AGE_ONE_MINUTE * 5

// The owner's PDS is whatever their DID doc says, so it may be slow or hostile.
const PDS_TIMEOUT_MS = 5_000
const RESOLVE_CONCURRENCY = 16

export type StoredRecord = { uri: string; cid: string; value: dev.npmx.collection.Main }

export type CollectionsDeps = {
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

  async getCollection(identifier: string, rkey: string): Promise<CollectionView | null> {
    const miniDoc = await this.deps.resolveIdentity(identifier)
    const stored = await this.getStoredRecord(miniDoc, rkey)
    if (!stored) return null

    const items = await mapWithConcurrency(
      stored.value.items,
      item => this.resolveItem(item.subjectRef, item.note),
      RESOLVE_CONCURRENCY,
    )
    return { ...toSummary(miniDoc, rkey, stored), items }
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
}
