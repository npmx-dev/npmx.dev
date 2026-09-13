import type { ModuleReplacement } from 'module-replacements'
import type { DependencySpec } from '~/utils/npm/package-dependency-sections'

async function fetchReplacements(
  deps: Record<string, DependencySpec>,
): Promise<Record<string, ModuleReplacement>> {
  const entries = Object.entries(deps)
  if (entries.length === 0) return {}

  const names = Array.from(new Set(entries.map(([, spec]) => spec.name)))
  try {
    const isSingle = names.length === 1
    const res = await $fetch<any>(`/api/replacements/${names.map(encodeURIComponent).join(',')}`)
    if (!res) return {}

    const map: Record<string, ModuleReplacement> = {}
    for (const [key, spec] of entries) {
      const match = isSingle ? res : res[spec.name]
      if (match?.replacement) map[key] = match.replacement
    }
    return map
  } catch {
    return {}
  }
}

/**
 * Fetch module replacement suggestions for a set of dependencies.
 * Returns an AsyncData result.
 */
export function useReplacementDependencies(
  dependencies: MaybeRefOrGetter<Record<string, DependencySpec> | undefined>,
) {
  const depsRef = computed(() => toValue(dependencies))

  const key = computed(() => {
    const deps = depsRef.value
    if (!deps) return 'replacements:none'
    const sorted = Object.keys(deps).sort()
    return sorted.length === 0
      ? 'replacements:none'
      : `replacements:${sorted.map(k => `${k}@${deps[k]!.version}`).join(',')}`
  })

  return useAsyncData<Record<string, ModuleReplacement>>(
    key.value,
    async () => {
      const deps = depsRef.value
      if (!deps || Object.keys(deps).length === 0) return {}
      return await fetchReplacements(deps)
    },
    {
      watch: [depsRef],
      default: () => ({}),
    },
  )
}
