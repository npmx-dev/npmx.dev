export default defineNuxtPlugin({
  name: 'preferences-sync',
  setup() {
    const { initSync } = useUserPreferences()
    const { applyStoredColorMode } = useColorModePreference()

    // Apply stored color mode preference early (before components mount)
    applyStoredColorMode()

    // Initialize server sync for authenticated users
    initSync()
  },
})
