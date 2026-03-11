import type { ModuleReplacement } from 'module-replacements'

async function fetchReplacements(
  deps: Record<string, string>,
): Promise<Record<string, ModuleReplacement>> {
  const names = Object.keys(deps)

  const results = await Promise.all(
    names.map(async name => {
      try {
        const replacement = await $fetch<ModuleReplacement | null>(`/api/replacements/${name}`)
        return { name, replacement }
      } catch {
        return { name, replacement: null }
      }
    }),
  )

  const map: Record<string, ModuleReplacement> = {}
  for (const { name, replacement } of results) {
    if (replacement) {
      map[name] = replacement
    }
  }
  return map
}

/**
 * Fetch module replacement suggestions for a set of dependencies.
 * Returns a reactive map of dependency name to ModuleReplacement.
 */
export function useReplacementDependencies(
  dependencies: MaybeRefOrGetter<Record<string, string> | undefined>,
) {
  const replacements = shallowRef<Record<string, ModuleReplacement>>({})
  let generation = 0

  if (import.meta.client) {
    watch(
      () => toValue(dependencies),
      async deps => {
        const currentGeneration = ++generation

        if (!deps || Object.keys(deps).length === 0) {
          replacements.value = {}
          return
        }

        try {
          const result = await fetchReplacements(deps)
          if (currentGeneration === generation) {
            replacements.value = result
          }
        } catch {
          // catastrophic failure, just keep whatever we have
        }
      },
      { immediate: true },
    )
  }

  return replacements
}
