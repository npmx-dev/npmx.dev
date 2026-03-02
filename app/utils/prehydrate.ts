import type { UserPreferences } from '#shared/schemas/userPreferences'
import type { UserLocalSettings } from '~/composables/useUserLocalSettings'

/**
 * Initialize user preferences before hydration to prevent flash/layout shift.
 * This sets CSS custom properties and data attributes that CSS can use
 * to show the correct content before Vue hydration occurs.
 *
 * Call this in app.vue or any page that needs early access to user preferences.
 */
export function initPreferencesOnPrehydrate() {
  // Callback is stringified by Nuxt - external variables won't be available.
  // All constants must be hardcoded inside the callback.
  onPrehydrate(() => {
    // Valid accent color IDs (must match --swatch-* variables defined in main.css)
    const accentColorIds = new Set([
      'sky',
      'coral',
      'amber',
      'emerald',
      'violet',
      'magenta',
      'neutral',
    ])

    // Valid package manager IDs
    const validPMs = new Set(['npm', 'pnpm', 'yarn', 'bun', 'deno', 'vlt'])

    // Read user preferences from localStorage
    let preferences: UserPreferences = {}
    try {
      preferences = JSON.parse(localStorage.getItem('npmx-user-preferences') || '{}')
    } catch {}

    const accentColorId = preferences.accentColorId
    if (accentColorId && accentColorIds.has(accentColorId)) {
      document.documentElement.style.setProperty('--accent-color', `var(--swatch-${accentColorId})`)
    }

    // Apply background accent
    const preferredBackgroundTheme = preferences.preferredBackgroundTheme
    if (preferredBackgroundTheme) {
      document.documentElement.dataset.bgTheme = preferredBackgroundTheme
    }

    // Read and apply package manager preference
    const storedPM = localStorage.getItem('npmx-pm')
    // Parse the stored value (it's stored as a JSON string by useLocalStorage)
    let pm = 'npm'
    if (storedPM) {
      try {
        const parsed = JSON.parse(storedPM)
        if (validPMs.has(parsed)) {
          pm = parsed
        }
      } catch {
        // If parsing fails, check if it's a plain string (legacy format)
        if (validPMs.has(storedPM)) {
          pm = storedPM
        }
      }
    }

    // Set data attribute for CSS-based visibility
    document.documentElement.dataset.pm = pm

    let localSettings: Partial<UserLocalSettings> = {}
    try {
      localSettings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
    } catch {}
    document.documentElement.dataset.collapsed = localSettings.sidebar?.collapsed?.join(' ') ?? ''
  })
}
