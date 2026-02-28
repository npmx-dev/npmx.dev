import type { UserPreferences } from '#shared/schemas/userPreferences'
import { DEFAULT_USER_PREFERENCES } from '#shared/schemas/userPreferences'
import type { ServerPreferencesResult } from '~/composables/useUserPreferencesSync.client'

export type HydratedUserPreferences = Required<Omit<UserPreferences, 'updatedAt'>> &
  Pick<UserPreferences, 'updatedAt'>

export function arePreferencesEqual(a: UserPreferences, b: UserPreferences): boolean {
  const keys = Object.keys(DEFAULT_USER_PREFERENCES) as (keyof typeof DEFAULT_USER_PREFERENCES)[]
  return keys.every(key => a[key] === b[key])
}

/**
 * Merge local preferences with server result.
 * - New user (first login): local wins, should be pushed to server.
 * - Returning user: server takes precedence, local fills any missing keys.
 */
export function mergePreferences(
  localPrefs: HydratedUserPreferences,
  serverResult: ServerPreferencesResult,
): { merged: HydratedUserPreferences; shouldPushToServer: boolean } {
  if (serverResult.isNewUser) {
    return { merged: localPrefs, shouldPushToServer: true }
  }

  const merged: HydratedUserPreferences = { ...localPrefs, ...serverResult.preferences }
  return { merged, shouldPushToServer: false }
}
