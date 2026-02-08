/**
 * Global setup for Nuxt vitest environment.
 *
 * This file stubs globals that are normally initialized by inline scripts
 * injected into the HTML document, which don't run in vitest's nuxt environment.
 */

// Stub the @nuxtjs/color-mode global helper
// The color-mode module injects a script that initializes this on window,
// but in vitest the script never runs since the HTML page isn't SSR'd.
// See: https://github.com/nuxt-modules/color-mode/issues/335
if (typeof window !== 'undefined') {
  const globalName = '__NUXT_COLOR_MODE__'

  // @ts-expect-error - dynamic global name
  if (!window[globalName]) {
    // @ts-expect-error - dynamic global name
    window[globalName] = {
      preference: 'system',
      value: 'dark',
      getColorScheme: () => 'dark',
      addColorScheme: () => {},
      removeColorScheme: () => {},
    }
  }

  // force npm search provider in tests for compatibility with our mocks
  const settingsKey = 'npmx-settings'
  try {
    const existing = JSON.parse(localStorage.getItem(settingsKey) || '{}')
    existing.searchProvider = 'npm'
    localStorage.setItem(settingsKey, JSON.stringify(existing))
  } catch {
    localStorage.setItem(settingsKey, JSON.stringify({ searchProvider: 'npm' }))
  }
}
