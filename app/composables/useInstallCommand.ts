import type { JsrPackageInfo } from '#shared/types/jsr'

/**
 * Composable for generating install commands with support for
 * multiple package managers, @types packages, and JSR.
 */
export function useInstallCommand(
  packageName: MaybeRefOrGetter<string | null>,
  requestedVersion: MaybeRefOrGetter<string | null>,
  jsrInfo: MaybeRefOrGetter<JsrPackageInfo | null>,
  typesPackageName: MaybeRefOrGetter<string | null>,
  installVersionOverride?: MaybeRefOrGetter<string | null>,
) {
  const selectedPM = useSelectedPackageManager()
  const { settings } = useSettings()

  // Check if we should show @types in install command
  const showTypesInInstall = computed(() => {
    return settings.value.includeTypesInInstall && !!toValue(typesPackageName)
  })

  const installCommandParts = computed(() => {
    const name = toValue(packageName)
    if (!name) return []
    const version = toValue(installVersionOverride) ?? toValue(requestedVersion)
    return getInstallCommandParts({
      packageName: name,
      packageManager: selectedPM.value,
      version,
      jsrInfo: toValue(jsrInfo),
    })
  })

  const installCommand = computed(() => {
    const name = toValue(packageName)
    if (!name) return ''
    const version = toValue(installVersionOverride) ?? toValue(requestedVersion)
    return getInstallCommand({
      packageName: name,
      packageManager: selectedPM.value,
      version,
      jsrInfo: toValue(jsrInfo),
    })
  })

  // @types install command parts (for display)
  const typesInstallCommandParts = computed(() => {
    const types = toValue(typesPackageName)
    if (!types) return []
    return getInstallCommandParts({
      packageName: types,
      packageManager: selectedPM.value,
      jsrInfo: null,
      dev: true,
    })
  })

  // Full install command including @types (for copying)
  const fullInstallCommand = computed(() => {
    if (!installCommand.value) return ''
    const types = toValue(typesPackageName)
    if (!showTypesInInstall.value || !types) {
      return installCommand.value
    }

    // Use semicolon to separate commands
    return `${installCommand.value}; ${getInstallCommand({
      packageName: types,
      packageManager: selectedPM.value,
      jsrInfo: null,
      dev: true,
    })}`
  })

  // Copy state
  const { copied, copy } = useClipboard({ copiedDuring: 2000 })

  async function copyInstallCommand() {
    if (!fullInstallCommand.value) return false
    await copy(fullInstallCommand.value)
    return true
  }

  return {
    selectedPM,
    installCommandParts,
    installCommand,
    typesInstallCommandParts,
    fullInstallCommand,
    showTypesInInstall,
    copied,
    copyInstallCommand,
  }
}
