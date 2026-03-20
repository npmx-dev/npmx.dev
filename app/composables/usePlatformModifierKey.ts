function detectApplePlatform() {
  if (!import.meta.client) return false

  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }

  const platform = nav.userAgentData?.platform ?? nav.platform ?? ''
  const userAgent = navigator.userAgent ?? ''

  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad|iPod/i.test(userAgent)
}

export function usePlatformModifierKey() {
  const isApplePlatform = useState('platform:is-apple', detectApplePlatform)

  if (import.meta.client) {
    onMounted(() => {
      isApplePlatform.value = detectApplePlatform()
    })
  }

  return {
    isApplePlatform: computed(() => isApplePlatform.value),
    primaryModifierKeyLabel: computed(() => (isApplePlatform.value ? '⌘' : 'Ctrl')),
    commandPaletteShortcutLabel: computed(() => (isApplePlatform.value ? '⌘ K' : 'Ctrl+K')),
  }
}
