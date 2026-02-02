import type { ACCENT_COLORS } from '#shared/utils/constants'

type AccentColorId = keyof typeof ACCENT_COLORS

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
    // Accent colors - hardcoded since ACCENT_COLORS can't be referenced
    const colors: Record<AccentColorId, string> = {
      rose: 'oklch(0.797 0.084 11.056)',
      amber: 'oklch(0.828 0.165 84.429)',
      emerald: 'oklch(0.792 0.153 166.95)',
      sky: 'oklch(0.787 0.128 230.318)',
      violet: 'oklch(0.714 0.148 286.067)',
      coral: 'oklch(0.704 0.177 14.75)',
    }

    // Valid package manager IDs
    const validPMs = new Set(['npm', 'pnpm', 'yarn', 'bun', 'deno', 'vlt'])

    // Read settings from localStorage
    const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')

    // Apply accent color
    const color = settings.accentColorId ? colors[settings.accentColorId as AccentColorId] : null
    if (color) {
      document.documentElement.style.setProperty('--accent-color', color)
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

    document.documentElement.dataset.collapsed = settings.sidebar?.collapsed?.join(' ') ?? ''
  })
}
