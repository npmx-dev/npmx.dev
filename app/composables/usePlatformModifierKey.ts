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
  const { t } = useI18n()
  const isApplePlatform = useState('platform:is-apple', detectApplePlatform)
  const ctrlKeyLabel = computed(() => t('shortcuts.ctrl_key'))

  if (import.meta.client) {
    onMounted(() => {
      isApplePlatform.value = detectApplePlatform()
    })
  }

  return {
    isApplePlatform: computed(() => isApplePlatform.value),
    primaryModifierKeyLabel: computed(() => (isApplePlatform.value ? '⌘' : ctrlKeyLabel.value)),
    commandPaletteShortcutLabel: computed(() =>
      isApplePlatform.value ? '⌘ K' : `${ctrlKeyLabel.value}+K`,
    ),
  }
}
