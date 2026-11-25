import { SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from '#shared/utils/constants'

const SESSION_MIGRATED_STORAGE_KEY = 'npmx-auth-hint-migrated'
const PREEXISTING_SETTINGS_STORAGE_KEY = 'npmx-settings'

let pendingMigrationCheck = false

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export function hasSessionHintCookie(): boolean {
  if (!import.meta.client) return false
  return document.cookie
    .split(';')
    .some(entry => entry.trim() === `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}`)
}

export function clearClientSessionHintCookie(): void {
  if (!import.meta.client) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

/**
 * Checks localStorage before useSettings() writes defaults so returning
 * visitors with a pre-existing httpOnly session get a one-time check while
 * fresh visitors and crawlers make no session request.
 */
export function initSessionHintMigration(): boolean {
  if (!import.meta.client) return false
  if (hasSessionHintCookie()) {
    markSessionHintMigrated()
    return false
  }
  if (safeLocalStorageGet(SESSION_MIGRATED_STORAGE_KEY) === '1') {
    pendingMigrationCheck = false
    return false
  }
  if (safeLocalStorageGet(PREEXISTING_SETTINGS_STORAGE_KEY) !== null) {
    pendingMigrationCheck = true
    return true
  }

  markSessionHintMigrated()
  return false
}

export function needsSessionHintMigration(): boolean {
  return import.meta.client && pendingMigrationCheck
}

export function markSessionHintMigrated(): void {
  pendingMigrationCheck = false
  if (import.meta.client) {
    safeLocalStorageSet(SESSION_MIGRATED_STORAGE_KEY, '1')
  }
}
