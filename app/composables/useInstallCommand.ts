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
    return getInstallCommandParts({
      packageName: name,
      packageManager: selectedPM.value,
      version: toValue(requestedVersion),
      jsrInfo: toValue(jsrInfo),
    })
  })

  const installCommand = computed(() => {
    const name = toValue(packageName)
    if (!name) return ''
    return getInstallCommand({
      packageName: name,
      packageManager: selectedPM.value,
      version: toValue(requestedVersion),
      jsrInfo: toValue(jsrInfo),
    })
  })

  // Get the dev dependency flag for the selected package manager
  const devFlag = computed(() => {
    // bun uses lowercase -d, all others use -D
    return selectedPM.value === 'bun' ? '-d' : '-D'
  })

  // @types install command parts (for display)
  const typesInstallCommandParts = computed(() => {
    const types = toValue(typesPackageName)
    if (!types) return []
    const pm = packageManagers.find(p => p.id === selectedPM.value)
    if (!pm) return []

    const pkgSpec = selectedPM.value === 'deno' ? `npm:${types}` : types

    return [pm.label, pm.action, devFlag.value, pkgSpec]
  })

  // Full install command including @types (for copying)
  const fullInstallCommand = computed(() => {
    if (!installCommand.value) return ''
    const types = toValue(typesPackageName)
    if (!showTypesInInstall.value || !types) {
      return installCommand.value
    }

    const pm = packageManagers.find(p => p.id === selectedPM.value)
    if (!pm) return installCommand.value

    const pkgSpec = selectedPM.value === 'deno' ? `npm:${types}` : types

    // Use semicolon to separate commands
    return `${installCommand.value}; ${pm.label} ${pm.action} ${devFlag.value} ${pkgSpec}`
  })

  // Copy state
  const { copied, copy } = useClipboard({ copiedDuring: 2000 })

  async function copyInstallCommand() {
    if (!fullInstallCommand.value) return
    await copy(fullInstallCommand.value)
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
