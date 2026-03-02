import { describe, expect, it } from 'vitest'
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '#shared/schemas/userPreferences'
import type { ServerPreferencesResult } from '~/composables/useUserPreferencesSync.client'
import {
  arePreferencesEqual,
  mergePreferences,
  type HydratedUserPreferences,
} from '~/utils/preferences-merge'

describe('user preferences merge logic', () => {
  const defaults: HydratedUserPreferences = { ...DEFAULT_USER_PREFERENCES }

  describe('arePreferencesEqual', () => {
    it('returns true when all preference keys match', () => {
      const a = { ...defaults, accentColorId: 'rose' }
      const b = { ...defaults, accentColorId: 'rose' }
      expect(arePreferencesEqual(a, b)).toBe(true)
    })

    it('returns false when a preference key differs', () => {
      const a = { ...defaults, accentColorId: 'rose' }
      const b = { ...defaults, accentColorId: 'amber' }
      expect(arePreferencesEqual(a, b)).toBe(false)
    })

    it('ignores updatedAt when comparing', () => {
      const a = { ...defaults, updatedAt: '2025-01-01T00:00:00Z' }
      const b = { ...defaults, updatedAt: '2026-02-28T12:00:00Z' }
      expect(arePreferencesEqual(a, b)).toBe(true)
    })
  })

  describe('first-time user (isNewUser: true)', () => {
    it('preserves local preferences when server has no stored prefs', () => {
      const localPrefs: HydratedUserPreferences = {
        ...defaults,
        accentColorId: 'rose',
        colorModePreference: 'dark',
        selectedLocale: 'de',
      }

      const serverResult: ServerPreferencesResult = {
        preferences: { ...DEFAULT_USER_PREFERENCES },
        isNewUser: true,
      }

      const { merged, shouldPushToServer } = mergePreferences(localPrefs, serverResult)

      expect(merged.accentColorId).toBe('rose')
      expect(merged.colorModePreference).toBe('dark')
      expect(merged.selectedLocale).toBe('de')
      expect(shouldPushToServer).toBe(true)
    })

    it('local prefs are returned unchanged', () => {
      const localPrefs: HydratedUserPreferences = {
        ...defaults,
        relativeDates: true,
        keyboardShortcuts: false,
      }

      const serverResult: ServerPreferencesResult = {
        preferences: { ...DEFAULT_USER_PREFERENCES },
        isNewUser: true,
      }

      const { merged } = mergePreferences(localPrefs, serverResult)

      expect(merged).toEqual(localPrefs)
    })
  })

  describe('returning user (isNewUser: false)', () => {
    it('server preferences override local preferences', () => {
      const localPrefs: HydratedUserPreferences = {
        ...defaults,
        accentColorId: 'rose',
        colorModePreference: 'dark',
      }

      const serverPrefs: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        accentColorId: 'amber',
        colorModePreference: 'light',
        updatedAt: '2026-01-15T10:00:00Z',
      }

      const serverResult: ServerPreferencesResult = {
        preferences: serverPrefs,
        isNewUser: false,
      }

      const { merged, shouldPushToServer } = mergePreferences(localPrefs, serverResult)

      expect(merged.accentColorId).toBe('amber')
      expect(merged.colorModePreference).toBe('light')
      expect(shouldPushToServer).toBe(false)
    })

    it('local preferences fill new keys not yet stored on server (schema migration)', () => {
      const localPrefs: HydratedUserPreferences = {
        ...defaults,
        accentColorId: 'rose',
        selectedLocale: 'ja',
      }

      // Simulates a server response from before a new preference key was added:
      // the server has accentColorId but not selectedLocale (added later)
      const serverPrefs: UserPreferences = {
        accentColorId: 'emerald',
        updatedAt: '2026-01-15T10:00:00Z',
      }

      const serverResult: ServerPreferencesResult = {
        preferences: serverPrefs,
        isNewUser: false,
      }

      const { merged } = mergePreferences(localPrefs, serverResult)

      // Server wins on accentColorId
      expect(merged.accentColorId).toBe('emerald')
      // Local fills in selectedLocale (not in server response)
      expect(merged.selectedLocale).toBe('ja')
    })

    it('returning user with default server prefs keeps defaults (not a false first-login)', () => {
      const localPrefs: HydratedUserPreferences = {
        ...defaults,
        accentColorId: 'rose',
      }

      // User explicitly saved defaults on another device
      const serverPrefs: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        updatedAt: '2026-02-01T00:00:00Z',
      }

      const serverResult: ServerPreferencesResult = {
        preferences: serverPrefs,
        isNewUser: false,
      }

      const { merged, shouldPushToServer } = mergePreferences(localPrefs, serverResult)

      // Server wins — user intentionally has defaults
      expect(merged.accentColorId).toBeNull()
      expect(shouldPushToServer).toBe(false)
    })
  })
})
