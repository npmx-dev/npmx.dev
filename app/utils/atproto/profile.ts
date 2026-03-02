import { FetchError } from 'ofetch'
import { handleAuthError } from './helpers'

export type UpdateProfileResult = {
  success: boolean
  error?: Error
}

/**
 * Update an NPMX Profile via the API
 */
export async function updateProfile(
  userHandle: string,
  {
    displayName,
    description,
    website,
  }: {
    displayName: string
    description?: string
    website?: string
  },
): Promise<UpdateProfileResult> {
  try {
    await $fetch<string>(`/api/social/profile/${userHandle}`, {
      method: 'PUT',
      body: { displayName, description, website },
    })
    return { success: true }
  } catch (e) {
    if (e instanceof FetchError) {
      await handleAuthError(e, userHandle)
    }
    return { success: false, error: e as Error }
  }
}
