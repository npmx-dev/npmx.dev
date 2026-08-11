import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

export interface LicenseChangeResponse {
  change: { from: string; to: string } | null
}

/**
 * Composable to detect license changes across all versions of a package
 */
export function useLicenseChanges(
  packageName: MaybeRefOrGetter<string | null | undefined>,
  resolvedVersion: MaybeRefOrGetter<string | null | undefined> = () => undefined,
) {
  const name = computed(() => toValue(packageName))
  if (!name) return { data: null } // Don't fetch if no name

  const version = computed(() => toValue(resolvedVersion) ?? 'latest')

  const url = computed(() => {
    return name.value ? `/api/registry/license-change/${encodeURIComponent(name.value)}` : ''
  })

  const result = useFetch<LicenseChangeResponse>(url, {
    query: computed(() => ({ version: version.value })),
    key: `license-change:${name.value}:${version.value}`,
    watch: [name, version],
  })

  return result
}
