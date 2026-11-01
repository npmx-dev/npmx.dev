import { FetchError } from 'ofetch'
import { handleAuthError } from '~/utils/atproto/helpers'
import type { PackageLikes } from '#shared/types/social'

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
export async function fetchProfileLikes(handle: string, cursor?: string | null, limit = 20) {
  try {
    return await $fetch(`/api/social/profile/${handle}/likes`, {
      query: { cursor, limit },
    })
  } catch (e) {
    // oxlint-disable-next-line no-console -- error logging
    console.error('failed to fetch profile likes', handle, cursor, limit, e)
    return { cursor: null, likes: null }
  }
}
