import type { VulnerabilityTreeResult } from '#shared/types/dependency-analysis'

/**
 * Shared composable for dependency analysis data (vulnerabilities, deprecated packages).
 * Fetches once and caches the result so multiple components can use it.
 * Before: useVulnerabilityTree - but now we use this for both vulnerabilities and deprecated packages.
 */
export function useDependencyAnalysis(
  packageName: MaybeRefOrGetter<string>,
  version: MaybeRefOrGetter<string>,
) {
  // Build a stable key from the current values
  const name = toValue(packageName)
  const ver = toValue(version)
  const key = `dep-analysis:v1:${name}@${ver}`

  // Use useState for SSR-safe caching across components
  const data = useState<VulnerabilityTreeResult | null>(key, () => null)
  const status = useState<'idle' | 'pending' | 'success' | 'error'>(`${key}:status`, () => 'idle')
  const error = useState<Error | null>(`${key}:error`, () => null)

  async function fetch() {
    const pkgName = toValue(packageName)
    const pkgVersion = toValue(version)

    if (!pkgName || !pkgVersion) return

    // Already fetched or fetching
    if (status.value === 'success' || status.value === 'pending') return

    status.value = 'pending'
    error.value = null

    try {
      const result = await $fetch<VulnerabilityTreeResult>(
        `/api/registry/vulnerabilities/${encodePackageName(pkgName)}/v/${pkgVersion}`,
      )
      data.value = result
      status.value = 'success'
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Failed to fetch dependency analysis')
      status.value = 'error'
    }
  }

  return {
    data: readonly(data),
    status: readonly(status),
    error: readonly(error),
    fetch,
  }
}
