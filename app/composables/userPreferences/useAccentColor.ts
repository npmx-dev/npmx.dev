import { ACCENT_COLORS } from '#shared/utils/constants'
import type { AccentColorId } from '#shared/schemas/userPreferences'

export function useAccentColor() {
  const { preferences } = useUserPreferencesState()
  const colorMode = useColorMode()

  const accentColors = computed(() => {
    const isDark = colorMode.value === 'dark'
    const colors = isDark ? ACCENT_COLORS.dark : ACCENT_COLORS.light

    return Object.entries(colors).map(([id, value]) => ({
      id: id as AccentColorId,
      name: id,
      value,
    }))
  })

  function setAccentColor(id: AccentColorId | null) {
    if (id) {
      document.documentElement.style.setProperty('--accent-color', `var(--swatch-${id})`)
    } else {
      document.documentElement.style.removeProperty('--accent-color')
    }
    preferences.value.accentColorId = id
  }

  return {
    accentColors,
    selectedAccentColor: computed(() => preferences.value.accentColorId),
    setAccentColor,
  }
}
