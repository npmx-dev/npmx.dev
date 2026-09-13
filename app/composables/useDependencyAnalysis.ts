import type { VulnerabilityTreeResult } from '#shared/types/dependency-analysis'

/**
 * Shared composable for dependency analysis data (vulnerabilities, deprecated packages).
 * Fetches once and caches the result so multiple components can use it.
 * Before: useVulnerabilityTree - but now we use this for both vulnerabilities and deprecated packages.
 */
export function useDependencyAnalysis(
  packageName: MaybeRefOrGetter<string>,
  version: MaybeRefOrGetter<string | null | undefined>,
) {
  const resolvedVersion = computed((): string | undefined => {
    const ver = toValue(version)
    return resolveMinVersion(ver) ?? undefined
  })

  return useFetch<VulnerabilityTreeResult>(
    () => {
      const pkg = toValue(packageName)
      const ver = resolvedVersion.value
      if (!pkg || !ver) return ''
      return `/api/registry/vulnerabilities/${encodePackageName(pkg)}/v/${ver}`
    },
    {
      key: () => `vuln:${toValue(packageName)}:${resolvedVersion.value}`,
      watch: [() => toValue(packageName), resolvedVersion],
      server: false,
      lazy: true,
    },
  )
}
