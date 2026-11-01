/**
 * Shared composable for dependency analysis data (vulnerabilities, deprecated packages).
 * Fetches once and caches the result so multiple components can use it.
 * Before: useVulnerabilityTree - but now we use this for both vulnerabilities and deprecated packages.
 *
 * Client-only and lazy: resolving the whole transitive dependency graph (one packument download
 * per dependency) plus OSV queries is far too slow to block the package page's server render. The
 * data only drives the vulnerability count and the vulnerability/deprecated trees, none of which
 * need to be in the server HTML.
 *
 * `useFetch` dedupes by key (the request URL), so all consumers share the same request/result.
 */
export function useDependencyAnalysis(
  packageName: MaybeRefOrGetter<string>,
  version: MaybeRefOrGetter<string>,
) {
  return useFetch(
    () =>
      `/api/registry/vulnerabilities/${encodePackageName(toValue(packageName))}/v/${toValue(version)}`,
    {
      server: false,
      lazy: true,
    },
  )
}
