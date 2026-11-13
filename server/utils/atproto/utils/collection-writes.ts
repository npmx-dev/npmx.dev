import type { OAuthSession } from '@atproto/oauth-client-node'
import type { InferOutput } from 'valibot'
import {
  Client,
  isDatetimeString,
  toDatetimeString,
  type AtUriString,
  type UriString,
} from '@atproto/lex'
import * as dev from '#shared/types/lexicons/dev'
import type { CollectionBodySchema } from '#shared/schemas/social'
import type { MiniDoc, ReactionState } from '#shared/types/social'
import {
  COLLECTION_SUBJECT_REF,
  COLLECTIONS_SCOPE,
  FOLLOWS_SCOPE,
  LIKES_SCOPE,
  MAX_COLLECTION_ITEMS,
} from '#shared/utils/constants'
import { throwOnMissingOAuthScope } from '#server/utils/atproto/oauth'
import type { Reaction } from './collections'

/** Writes to collections and their likes and follows, as the signed-in user. */

type CollectionBody = InferOutput<typeof CollectionBodySchema>
type CollectionRef = { identifier: string; rkey: string }
type RawRecord = { cid: string; value: unknown }
type Item = { subjectRef: string; note?: string }
export type CollectionWriteResult = { uri: string; cid: string; did: string; rkey: string }

// Quick toggles in the picker race each other; a lost swap is retried on the fresh record.
const ITEM_CHANGE_ATTEMPTS = 3

export function requireOAuthSession(oAuthSession: OAuthSession | undefined) {
  const did = oAuthSession?.did.toString()
  if (!oAuthSession || !did) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return { oAuthSession, did }
}

/** Throws ERROR_NEED_REAUTH for sessions from before the collections scope existed. */
export async function requireCollectionWriteAccess(session: OAuthSession | undefined) {
  const { oAuthSession } = requireOAuthSession(session)
  await throwOnMissingOAuthScope(oAuthSession, COLLECTIONS_SCOPE)
}

async function getWriter(session: OAuthSession | undefined, scope: string) {
  const { oAuthSession, did } = requireOAuthSession(session)
  await throwOnMissingOAuthScope(oAuthSession, scope)
  return { client: new Client(oAuthSession), did }
}

async function resolveOwner({ identifier }: CollectionRef) {
  return (await new IdentityUtils().getMiniDoc(identifier)) as MiniDoc
}

async function requireOwnCollection(ref: CollectionRef, did: string) {
  const owner = await resolveOwner(ref)
  if (owner.did !== did) {
    throw createError({ status: 403, message: 'You can only change your own collections' })
  }
  return owner
}

const conflict = () =>
  createError({ status: 409, message: 'Collection changed since it was loaded' })

/**
 * Builds the record to write. When editing, fields we don't know about are kept so we don't
 * strip another client's extensions; items are replaced wholesale.
 */
export function buildCollectionRecord(body: CollectionBody, existing?: unknown) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  const { $type: _, description: __, ...preserved } = base
  const createdAt =
    typeof base.createdAt === 'string' && isDatetimeString(base.createdAt)
      ? base.createdAt
      : toDatetimeString(new Date())

  return {
    ...preserved,
    name: body.name,
    ...(body.description ? { description: body.description } : {}),
    items: body.items.map(item => ({
      subjectRef: item.subjectRef as UriString,
      ...(item.note ? { note: item.note } : {}),
    })),
    createdAt,
  }
}
type CollectionRecordValue = ReturnType<typeof buildCollectionRecord>

/** Drops `remove`, then appends whatever of `add` isn't already there. Existing items are kept as is. */
export function applyItemChanges<T extends Item>(
  items: T[],
  add: string[],
  remove: string[],
): (T | Item)[] {
  const removed = new Set(remove)
  const kept = items.filter(item => !removed.has(item.subjectRef))
  const present = new Set(kept.map(item => item.subjectRef))
  const added = [...new Set(add)]
    .filter(ref => !present.has(ref))
    .map(subjectRef => ({ subjectRef }))
  return [...kept, ...added]
}

const isInvalidSwapError = (error: unknown) =>
  (error as { error?: unknown } | null)?.error === 'InvalidSwap'

/** Caches our own write so the next read sees it rather than a stale cached copy. */
async function afterWrite(
  did: string,
  rkey: string,
  cid: string,
  value: CollectionRecordValue,
): Promise<CollectionWriteResult> {
  const record: dev.npmx.collection.Main = { $type: dev.npmx.collection.$nsid, ...value }
  // Best-effort: the PDS already has the write, so a cache error mustn't fail the request
  await new CollectionsUtils()
    .setStoredRecord(did, rkey, { cid, value: record })
    .catch(error => console.error('[collections] Caching a write failed', error))
  return { uri: COLLECTION_SUBJECT_REF(did, rkey), cid, did, rkey }
}

/**
 * Read-modify-write against the PDS, with `swapRecord` so a concurrent edit is never clobbered.
 * `build` may throw to reject the current record; a lost swap re-runs it on the fresh one.
 */
async function editCollection(
  client: Client,
  owner: MiniDoc,
  rkey: string,
  build: (existing: RawRecord) => CollectionRecordValue,
  maxAttempts = 1,
) {
  const utils = new CollectionsUtils()
  for (let attempt = 1; ; attempt++) {
    const existing = await utils.fetchRawRecord(owner, rkey)
    if (!existing) throw createError({ status: 404, message: 'Collection not found' })
    const value = build(existing)
    try {
      const result = await client.put(dev.npmx.collection, value, {
        rkey,
        swapRecord: existing.cid,
      })
      return { ...(await afterWrite(owner.did, rkey, result.cid, value)), value }
    } catch (error) {
      if (!isInvalidSwapError(error) || attempt >= maxAttempts) {
        throw isInvalidSwapError(error) ? conflict() : error
      }
    }
  }
}

export async function createCollection(session: OAuthSession | undefined, body: CollectionBody) {
  const { client, did } = await getWriter(session, COLLECTIONS_SCOPE)
  const value = buildCollectionRecord(body)
  const result = await client.create(dev.npmx.collection, value)
  return await afterWrite(did, result.uri.split('/').pop()!, result.cid, value)
}

/** Replaces a collection. Fails with 409 if it changed since `cid`, the version being edited. */
export async function updateCollection(
  session: OAuthSession | undefined,
  ref: CollectionRef,
  { cid, ...body }: CollectionBody & { cid: string },
) {
  const { client, did } = await getWriter(session, COLLECTIONS_SCOPE)
  const owner = await requireOwnCollection(ref, did)
  const { value: _, ...result } = await editCollection(client, owner, ref.rkey, existing => {
    if (existing.cid !== cid) throw conflict()
    return buildCollectionRecord(body, existing.value)
  })
  return result
}

/** Adds and removes items without the caller sending the whole collection. */
export async function changeCollectionItems(
  session: OAuthSession | undefined,
  ref: CollectionRef,
  { add, remove }: { add: string[]; remove: string[] },
) {
  const { client, did } = await getWriter(session, COLLECTIONS_SCOPE)
  const owner = await requireOwnCollection(ref, did)
  const { value, ...result } = await editCollection(
    client,
    owner,
    ref.rkey,
    existing => {
      const current = dev.npmx.collection.$safeValidate(existing.value)
      if (!current.success) {
        throw createError({ status: 422, message: 'Collection record is not valid' })
      }
      // The raw items, not the validated copies, so fields other apps put on items survive
      const rawItems = (existing.value as { items: dev.npmx.collection.Item[] }).items
      const items = applyItemChanges(rawItems, add, remove)
      if (items.length > MAX_COLLECTION_ITEMS) {
        throw createError({ status: 400, message: 'Collection is full' })
      }
      const { name, description } = current.value
      return {
        ...buildCollectionRecord({ name, description, items: [] }, existing.value),
        items: items as dev.npmx.collection.Item[],
      }
    },
    ITEM_CHANGE_ATTEMPTS,
  )
  return { ...result, subjectRefs: value.items.map(item => item.subjectRef) }
}

export async function deleteCollection(session: OAuthSession | undefined, ref: CollectionRef) {
  const { client, did } = await getWriter(session, COLLECTIONS_SCOPE)
  await requireOwnCollection(ref, did)
  await client.delete(dev.npmx.collection, { rkey: ref.rkey })
  await new CollectionsUtils()
    .setStoredRecord(did, ref.rkey, null)
    .catch(error => console.error('[collections] Caching a delete failed', error))
  return { uri: COLLECTION_SUBJECT_REF(did, ref.rkey) }
}

const REACTION_SCOPES: Record<Reaction, string> = { like: LIKES_SCOPE, follow: FOLLOWS_SCOPE }

/**
 * Likes or follows (`on`) or un-likes or un-follows a collection.
 * Idempotent: asking for the state the viewer is already in changes nothing.
 */
export async function setReaction(
  session: OAuthSession | undefined,
  ref: CollectionRef,
  reaction: Reaction,
  on: boolean,
): Promise<ReactionState> {
  const { client, did } = await getWriter(session, REACTION_SCOPES[reaction])
  const owner = await resolveOwner(ref)
  const uri = COLLECTION_SUBJECT_REF(owner.did, ref.rkey)
  const utils = new CollectionsUtils()
  const existing = await utils.getViewerReaction(reaction, uri, did)
  if (Boolean(existing) === on) return await utils.getReaction(reaction, uri, did)
  // Owners follow their own collections implicitly, and a record would inflate the count
  if (on && reaction === 'follow' && owner.did === did) {
    throw createError({ status: 400, message: 'You already follow your own collections' })
  }
  const totalBefore = await utils.getReactionTotal(reaction, uri)

  if (!on) {
    await (reaction === 'like'
      ? client.delete(dev.npmx.feed.like, { rkey: existing!.rkey })
      : client.delete(dev.npmx.graph.follow, { rkey: existing!.rkey }))
    return await utils.recordUnreaction(reaction, uri, did, totalBefore)
  }

  if (!(await utils.getStoredRecord(owner, ref.rkey))) {
    throw createError({ status: 404, message: 'Collection not found' })
  }
  const createdAt = toDatetimeString(new Date())
  // A like's subjectRef, not its CID-pinned `subject`: collections change, likes shouldn't break.
  const created = await (reaction === 'like'
    ? client.create(dev.npmx.feed.like, { createdAt, subjectRef: uri as UriString })
    : client.create(dev.npmx.graph.follow, { createdAt, subject: uri as AtUriString }))
  return await utils.recordReaction(reaction, uri, did, created.uri.split('/').pop()!, totalBefore)
}
