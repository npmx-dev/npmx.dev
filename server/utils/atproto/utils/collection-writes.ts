import type { OAuthSession } from '@atproto/oauth-client-node'
import type { InferOutput } from 'valibot'
import { Client, isDatetimeString, toDatetimeString, type UriString } from '@atproto/lex'
import * as dev from '#shared/types/lexicons/dev'
import type { CollectionBodySchema } from '#shared/schemas/social'
import type { MiniDoc } from '#shared/types/social'
import { COLLECTION_SUBJECT_REF, COLLECTIONS_SCOPE } from '#shared/utils/constants'
import { throwOnMissingOAuthScope } from '#server/utils/atproto/oauth'

/** Writes to collections, as the signed-in user. */

type CollectionBody = InferOutput<typeof CollectionBodySchema>
type CollectionRef = { identifier: string; rkey: string }
type RawRecord = { cid: string; value: unknown }
export type CollectionWriteResult = { uri: string; cid: string; did: string; rkey: string }

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
 * `build` may throw to reject the current record.
 */
async function editCollection(
  client: Client,
  owner: MiniDoc,
  rkey: string,
  build: (existing: RawRecord) => CollectionRecordValue,
) {
  const existing = await new CollectionsUtils().fetchRawRecord(owner, rkey)
  if (!existing) throw createError({ status: 404, message: 'Collection not found' })
  const value = build(existing)
  try {
    const result = await client.put(dev.npmx.collection, value, {
      rkey,
      swapRecord: existing.cid,
    })
    return await afterWrite(owner.did, rkey, result.cid, value)
  } catch (error) {
    throw isInvalidSwapError(error) ? conflict() : error
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
  return await editCollection(client, owner, ref.rkey, existing => {
    if (existing.cid !== cid) throw conflict()
    return buildCollectionRecord(body, existing.value)
  })
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
