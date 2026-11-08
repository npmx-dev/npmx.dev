import { FetchError } from 'ofetch'
import type { InferInput } from 'valibot'
import type { CollectionBodySchema } from '#shared/schemas/social'
import type { CollectionSummary } from '#shared/types/social'
import { authRedirect, handleAuthError } from '~/utils/atproto/helpers'

export type CollectionBody = InferInput<typeof CollectionBodySchema>
export type CollectionWriteResult = { uri: string; cid: string; did: string; rkey: string }
export const collectionPath = (identifier: string, rkey: string) =>
  `/api/social/collections/${encodeURIComponent(identifier)}/${encodeURIComponent(rkey)}`

/** Parses a `<did or handle>/<rkey>` query value, as used by `?from=` and `?includes=`. */
export function parseCollectionQuery(value: unknown) {
  const [identifier, rkey] = typeof value === 'string' ? value.split('/') : []
  return identifier && rkey ? { identifier, rkey } : null
}

// Re-authenticates when the session lacks a newly added scope, as the likes helpers do.
async function request<T>(run: () => Promise<T>, userHandle: string | null | undefined) {
  try {
    return await run()
  } catch (e) {
    if (e instanceof FetchError) await handleAuthError(e, userHandle)
    throw e
  }
}

/**
 * Sessions from before collections existed lack the scope, and the re-auth redirect drops the
 * page's state. Checking before the editor opens means the user never loses a draft to it.
 */
export async function ensureCollectionWriteAccess(
  userHandle: string | null | undefined,
  redirectTo: string,
) {
  try {
    await $fetch('/api/social/collections/write-access')
  } catch (e) {
    // Anything else surfaces on save
    if (e instanceof FetchError && e.data?.message === ERROR_NEED_REAUTH && userHandle) {
      await authRedirect(userHandle, { redirectTo })
    }
  }
}

export const isConflict = (e: unknown) => e instanceof FetchError && e.statusCode === 409

export function createCollection(body: CollectionBody, userHandle?: string | null) {
  return request(
    () =>
      $fetch<CollectionWriteResult>('/api/social/collections', {
        method: 'POST',
        body,
      }),
    userHandle,
  )
}

export function updateCollection(
  identifier: string,
  rkey: string,
  body: CollectionBody & { cid: string },
  userHandle?: string | null,
) {
  return request(
    () => $fetch<CollectionWriteResult>(collectionPath(identifier, rkey), { method: 'PUT', body }),
    userHandle,
  )
}

export function deleteCollection(identifier: string, rkey: string, userHandle?: string | null) {
  return request(
    () => $fetch<{ uri: string }>(collectionPath(identifier, rkey), { method: 'DELETE' }),
    userHandle,
  )
}

export function fetchUserCollections(identifier: string, cursor?: string | null, limit = 20) {
  return $fetch<{ cursor?: string; items: CollectionSummary[] }>(
    `/api/social/collections/${encodeURIComponent(identifier)}`,
    { query: { cursor: cursor ?? undefined, limit } },
  )
}

/**
 * Turns what a user pastes into the editor into a subjectRef: a package name, an npmx package or
 * collection URL, or a collection AT-URI. Collection page URLs may use a handle, so resolving
 * those needs the API; returns null when the input isn't recognizable.
 */
export async function resolveSubjectRefInput(input: string): Promise<string | null> {
  const value = input.trim()
  if (!value) return null

  if (value.startsWith('at://')) return value

  const collectionPage = /^https?:\/\/(?:[\w-]+\.)?npmx\.dev\/collections\/([^/]+)\/([^/?#]+)/.exec(
    value,
  )
  if (collectionPage) {
    const [, identifier, rkey] = collectionPage
    try {
      const { uri } = await $fetch<CollectionSummary>(collectionPath(identifier!, rkey!))
      return uri
    } catch {
      return null
    }
  }

  const packagePage = /^https?:\/\/(?:[\w-]+\.)?npmx\.dev\/package\/(.+?)\/?$/.exec(value)
  if (!packagePage) return PACKAGE_SUBJECT_REF(value)
  try {
    return PACKAGE_SUBJECT_REF(decodeURIComponent(packagePage[1]!))
  } catch {
    // Malformed percent-encoding
    return null
  }
}
