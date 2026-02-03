import { FetchError } from 'ofetch'
import { handleAuthError } from '~/utils/atproto/helpers'
import type { PackageLikes } from '#shared/types/social'

export type LikeResult = { success: true; data: PackageLikes } | { success: false; error: Error }

/**
 * Like a package via the API
 */
export async function likePackage(
  packageName: string,
  userHandle?: string | null,
): Promise<LikeResult> {
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
export async function unlikePackage(
  packageName: string,
  userHandle?: string | null,
): Promise<LikeResult> {
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
