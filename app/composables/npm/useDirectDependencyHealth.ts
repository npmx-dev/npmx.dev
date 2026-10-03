import type { DirectDependencyHealthResult } from '#shared/types/dependency-analysis'
import { DIRECT_DEPS_HEALTH_MAX } from '#shared/utils/constants'
import type { DependencySpec } from '~/utils/npm/package-dependency-sections'

const EMPTY_HEALTH: DirectDependencyHealthResult = {
  vulnerable: {},
  deprecated: {},
}

/** Lazily fetch direct dependency health in display-order batches. */
export function useDirectDependencyHealth(
  dependencies: MaybeRefOrGetter<Record<string, DependencySpec> | undefined>,
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
    if (!deps || !deps[name]) return

    const ordered = toValue(orderedNames)
    const startIndex = ordered.indexOf(name)
    if (startIndex === -1) return

    const batchKeys: string[] = []
    const batchPayload: Record<string, string> = {}

    for (let i = startIndex; i < ordered.length; i++) {
      const candidate = ordered[i]!
      if (settled.has(candidate)) continue
      const itemSpec: DependencySpec | undefined = deps[candidate]
      if (!itemSpec) continue

      const targetName = itemSpec.name
      const targetVersion = itemSpec.version

      if (Object.hasOwn(batchPayload, targetName) && batchPayload[targetName] !== targetVersion) {
        continue
      }

      batchPayload[targetName] = targetVersion
      settled.add(candidate)
      batchKeys.push(candidate)
      if (Object.keys(batchPayload).length === DIRECT_DEPS_HEALTH_MAX) break
    }

    if (batchKeys.length === 0) return

    const currentGeneration = generation

    try {
      const result = await $fetch<DirectDependencyHealthResult>(
        '/api/registry/direct-deps-health',
        {
          method: 'POST',
          body: { dependencies: batchPayload },
        },
      )

      if (currentGeneration !== generation) return

      const newVulnerable = { ...health.value.vulnerable }
      const newDeprecated = { ...health.value.deprecated }

      for (const candidateKey of batchKeys) {
        const itemSpec: DependencySpec | undefined = deps[candidateKey]
        if (!itemSpec) continue
        const targetName = itemSpec.name

        const vulnInfo = result.vulnerable[targetName]
        if (vulnInfo) {
          newVulnerable[candidateKey] = vulnInfo
        }

        const depInfo = result.deprecated[targetName]
        if (depInfo) {
          newDeprecated[candidateKey] = depInfo
        }
      }

      health.value = {
        vulnerable: newVulnerable,
        deprecated: newDeprecated,
      }
    } catch {
      if (currentGeneration === generation) {
        for (const candidateKey of batchKeys) settled.delete(candidateKey)
      }
    }
  }

  return { health, requestHealth }
}
