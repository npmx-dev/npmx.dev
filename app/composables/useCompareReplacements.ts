import type { ModuleReplacement } from 'module-replacements'

export interface ReplacementSuggestion {
  forPackage: string
  replacement: ModuleReplacement
}

/**
 * Replacement types that suggest "no dependency" (can be replaced with native code or inline).
 */
const NO_DEP_REPLACEMENT_TYPES = ['native', 'simple'] as const

/**
 * Replacement types that are informational only.
 * These suggest alternative packages exist but don't fit the "no dependency" pattern.
 */
const INFO_REPLACEMENT_TYPES = ['documented'] as const

/**
 * Composable for fetching module replacement suggestions for packages in comparison.
 * Returns replacements split into "no dep" (actionable) and informational categories.
 */
export function useCompareReplacements(packageNames: MaybeRefOrGetter<string[]>) {
  const packages = computed(() => toValue(packageNames))

  // Cache replacement data by package name
  const replacements = shallowRef(new Map<string, ModuleReplacement | null>())
  const loading = shallowRef(false)

  // Fetch replacements for all packages
  async function fetchReplacements(names: string[]) {
    if (names.length === 0) return

    // Filter out packages we've already checked
    const namesToCheck = names.filter(name => !replacements.value.has(name))
    if (namesToCheck.length === 0) return

    loading.value = true

    try {
      const results = await Promise.all(
        namesToCheck.map(async name => {
          try {
            const replacement = await $fetch<ModuleReplacement | null>(`/api/replacements/${name}`)
            return { name, replacement }
          } catch {
            return { name, replacement: null }
          }
        }),
      )

      const newReplacements = new Map(replacements.value)
      for (const { name, replacement } of results) {
        newReplacements.set(name, replacement)
      }
      replacements.value = newReplacements
    } finally {
      loading.value = false
    }
  }

  // Watch for package changes and fetch replacements
  if (import.meta.client) {
    watch(
      packages,
      newPackages => {
        fetchReplacements(newPackages)
      },
      { immediate: true },
    )
  }

  // Build suggestions from replacements
  const allSuggestions = computed(() => {
    const result: ReplacementSuggestion[] = []

    for (const pkg of packages.value) {
      const replacement = replacements.value.get(pkg)
      if (!replacement) continue

      result.push({ forPackage: pkg, replacement })
    }

    return result
  })

  // Suggestions that prompt adding the "no dep" column (native, simple)
  const noDepSuggestions = computed(() =>
    allSuggestions.value.filter(s =>
      (NO_DEP_REPLACEMENT_TYPES as readonly string[]).includes(s.replacement.type),
    ),
  )

  // Informational suggestions that don't prompt "no dep" (documented)
  const infoSuggestions = computed(() =>
    allSuggestions.value.filter(s =>
      (INFO_REPLACEMENT_TYPES as readonly string[]).includes(s.replacement.type),
    ),
  )

  return {
    replacements: readonly(replacements),
    noDepSuggestions: readonly(noDepSuggestions),
    infoSuggestions: readonly(infoSuggestions),
    loading: readonly(loading),
  }
}
