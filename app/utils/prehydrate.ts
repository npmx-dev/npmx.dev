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
    const accentColorIds = new Set(['coral', 'amber', 'emerald', 'sky', 'violet', 'magenta'])

    // Valid package manager IDs
    const validPMs = new Set(['npm', 'pnpm', 'yarn', 'bun', 'deno', 'vlt'])

    // Read settings from localStorage
    const settings = JSON.parse(
      localStorage.getItem('npmx-settings') || '{}',
    ) as Partial<AppSettings>

    const accentColorId = settings.accentColorId
    if (accentColorId && accentColorIds.has(accentColorId)) {
      document.documentElement.style.setProperty('--accent-color', `var(--swatch-${accentColorId})`)
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
