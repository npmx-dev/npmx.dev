import type { ACCENT_COLORS } from '#shared/utils/constants'

type AccentColorId = keyof typeof ACCENT_COLORS.light // for both themes color names are same

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

    const colors = {
      light: {
        coral: 'oklch(0.70 0.19 14.75)',
        amber: 'oklch(0.8 0.25 84.429)',
        emerald: 'oklch(0.70 0.17 166.95)',
        sky: 'oklch(0.70 0.15 230.318)',
        violet: 'oklch(0.70 0.17 286.067)',
        magenta: 'oklch(0.75 0.18 330)',
      },
      dark: {
        coral: 'oklch(0.704 0.177 14.75)',
        amber: 'oklch(0.828 0.165 84.429)',
        emerald: 'oklch(0.792 0.153 166.95)',
        sky: 'oklch(0.787 0.128 230.318)',
        violet: 'oklch(0.78 0.148 286.067)',
        magenta: 'oklch(0.78 0.15 330)',
      },
    }

    // Valid package manager IDs
    const validPMs = new Set(['npm', 'pnpm', 'yarn', 'bun', 'deno', 'vlt'])

    // Read settings from localStorage
    const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')

    // Determine theme (default to 'dark')
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

    // Apply accent color based on theme
    const accentColorId = settings.accentColorId as AccentColorId | undefined
    if (accentColorId && colors[theme][accentColorId]) {
      document.documentElement.style.setProperty('--accent-color', colors[theme][accentColorId])
    }

    // Apply background accent
    const preferredBackgroundTheme = settings.preferredBackgroundTheme
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

    document.documentElement.dataset.collapsed = settings.sidebar?.collapsed?.join(' ') ?? ''
  })
}
