const APPLE_PLATFORM_RE = /Mac|iPhone|iPad|iPod/i

function detectApplePlatform() {
  if (!import.meta.client) return false

  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }

  const platform = nav.userAgentData?.platform ?? nav.platform ?? ''
  const userAgent = navigator.userAgent ?? ''

  return APPLE_PLATFORM_RE.test(platform) || APPLE_PLATFORM_RE.test(userAgent)
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
