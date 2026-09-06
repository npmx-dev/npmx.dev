import type { DirectDependencyHealthResult } from '#shared/types/dependency-analysis'
import { DIRECT_DEPS_HEALTH_MAX } from '#shared/utils/constants'

const EMPTY_HEALTH: DirectDependencyHealthResult = {
  vulnerable: {},
  deprecated: {},
}

/** Lazily fetch direct dependency health in display-order batches. */
export function useDirectDependencyHealth(
  dependencies: MaybeRefOrGetter<Record<string, string> | undefined>,
  orderedNames: MaybeRefOrGetter<readonly string[]>,
) {
  const health = shallowRef<DirectDependencyHealthResult>(EMPTY_HEALTH)

  const settled = new Set<string>()
  let generation = 0

  watch(
    () => toValue(dependencies),
    () => {
      generation++
      settled.clear()
      health.value = EMPTY_HEALTH
    },
    { immediate: true },
  )

  async function requestHealth(name: string) {
    if (!import.meta.client || settled.has(name)) return

    const deps = toValue(dependencies)
    if (!deps?.[name]) return

    const ordered = toValue(orderedNames)
    const startIndex = ordered.indexOf(name)
    if (startIndex === -1) return

    const batchNames: string[] = []
    for (let i = startIndex; i < ordered.length; i++) {
      const candidate = ordered[i]!
      if (settled.has(candidate) || !deps[candidate]) continue
      settled.add(candidate)
      batchNames.push(candidate)
      if (batchNames.length === DIRECT_DEPS_HEALTH_MAX) break
    }

    const batch = Object.fromEntries(batchNames.map(candidate => [candidate, deps[candidate]!]))
    const currentGeneration = generation

    try {
      const result = await $fetch<DirectDependencyHealthResult>(
        '/api/registry/direct-deps-health',
        {
          method: 'POST',
          body: { dependencies: batch },
        },
      )

      if (currentGeneration !== generation) return

      health.value = {
        vulnerable: { ...health.value.vulnerable, ...result.vulnerable },
        deprecated: { ...health.value.deprecated, ...result.deprecated },
      }
    } catch {
      if (currentGeneration === generation) {
        for (const candidate of batchNames) settled.delete(candidate)
      }
    }
  }

  return { health, requestHealth }
}
