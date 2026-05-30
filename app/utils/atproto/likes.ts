import { FetchError } from 'ofetch'
import { handleAuthError } from '~/utils/atproto/helpers'
import type { PackageLikes } from '#shared/types/social'

export type PaginatedProfileLikes = {
  records: {
    value: {
      subjectRef: string
    }
  }[]
  cursor: string | null
  hasNextPage: boolean
}

type LikeResult = { success: true; data: PackageLikes } | { success: false; error: Error }

/**
 * Like a package via the API
 */
async function likePackage(packageName: string, userHandle?: string | null): Promise<LikeResult> {
  try {
    const result = await $fetch<PackageLikes>('/api/social/like', {
      method: 'POST',
      body: { packageName },
    })
    return { success: true, data: result }
  } catch (e) {
    if (e instanceof FetchError) {
      await handleAuthError(e, userHandle)
    }
    return { success: false, error: e as Error }
  }
}

/**
 * Unlike a package via the API
 */
async function unlikePackage(packageName: string, userHandle?: string | null): Promise<LikeResult> {
  try {
    const result = await $fetch<PackageLikes>('/api/social/like', {
      method: 'DELETE',
      body: { packageName },
    })
    return { success: true, data: result }
  } catch (e) {
    if (e instanceof FetchError) {
      await handleAuthError(e, userHandle)
    }
    return { success: false, error: e as Error }
  }
}

/**
 * Toggle like status for a package
 */
export async function togglePackageLike(
  packageName: string,
  currentlyLiked: boolean,
  userHandle?: string | null,
): Promise<LikeResult> {
  return currentlyLiked
    ? unlikePackage(packageName, userHandle)
    : likePackage(packageName, userHandle)
}

/**
 * Fetches paginated profile likes for a given handle.
 */
export async function fetchProfileLikes(
  handle: string,
  cursor?: string | null,
  limit = 20,
): Promise<PaginatedProfileLikes> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) {
    params.set('cursor', cursor)
  }

  try {
    const result = await $fetch<PaginatedProfileLikes>(
      `/api/social/profile/${handle}/likes?${params.toString()}`,
    )
    return result
  } catch (e) {
    if (e instanceof FetchError) {
      await handleAuthError(e, undefined)
    }
    return { records: [], cursor: null, hasNextPage: false }
  }
}
