import type { UserPreferences } from '#shared/schemas/userPreferences'
import {
  USER_PREFERENCES_STORAGE_BASE,
  DEFAULT_USER_PREFERENCES,
} from '#shared/schemas/userPreferences'

export class UserPreferencesStore {
  private readonly storage = useStorage<UserPreferences>(USER_PREFERENCES_STORAGE_BASE)

  async get(did: string): Promise<UserPreferences | null> {
    const result = await this.storage.getItem(did)
    return result ?? null
  }

  async set(did: string, preferences: UserPreferences): Promise<void> {
    const withTimestamp: UserPreferences = {
      ...preferences,
      updatedAt: new Date().toISOString(),
    }
    await this.storage.setItem(did, withTimestamp)
  }

  async merge(did: string, partial: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = await this.get(did)
    const base = existing ?? { ...DEFAULT_USER_PREFERENCES }

    const merged: UserPreferences = {
      ...base,
      ...partial,
      updatedAt: new Date().toISOString(),
    }

    await this.set(did, merged)
    return merged
  }

  async delete(did: string): Promise<void> {
    await this.storage.removeItem(did)
  }
}

let storeInstance: UserPreferencesStore | null = null

export function useUserPreferencesStore(): UserPreferencesStore {
  if (!storeInstance) {
    storeInstance = new UserPreferencesStore()
  }
  return storeInstance
}
