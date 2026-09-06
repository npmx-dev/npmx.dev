import type { PackageVersionsInfo } from 'fast-npm-meta'
import { getVersionsBatch } from 'fast-npm-meta'
import { difference, findMaxSatisfying, getMajor, getMinor, isGreater, isStable } from 'verkit'
import {
  type OutdatedDependencyInfo,
  isNonSemverConstraint,
  constraintIncludesPrerelease,
} from '~/utils/npm/problematic-dependencies'
import type { DependencySpec } from '~/utils/npm/package-dependency-sections'

export function resolveOutdated(
  versions: string[],
  latestTag: string,
  constraint: string,
): OutdatedDependencyInfo | null {
  if (constraint === 'latest') return null

  let filteredVersions = versions
  if (!constraintIncludesPrerelease(constraint)) {
    filteredVersions = versions.filter(v => isStable(v))
  }

  const resolved = findMaxSatisfying(filteredVersions, constraint)
  if (!resolved || resolved === latestTag || isGreater(resolved, latestTag)) return null

  const diffType = difference(resolved, latestTag)
  const majorsBehind = getMajor(latestTag) - getMajor(resolved)
  const minorsBehind = majorsBehind === 0 ? getMinor(latestTag) - getMinor(resolved) : 0

  return {
    resolved,
    latest: latestTag,
    majorsBehind,
    minorsBehind,
    diffType,
  }
}

async function fetchOutdatedMap(
  deps: Record<string, DependencySpec>,
): Promise<Record<string, OutdatedDependencyInfo>> {
  const semverEntries = Object.entries(deps).filter(
    ([, spec]) => !isNonSemverConstraint(spec.version),
  )
  if (semverEntries.length === 0) return {}

  const names = Array.from(new Set(semverEntries.map(([, spec]) => spec.name)))
  const dataList = await getVersionsBatch(names, { throw: false })

  const versionMap = new Map<string, PackageVersionsInfo>()
  for (const data of dataList) {
    if (data && !('error' in data)) versionMap.set(data.name, data)
  }

  const results: Record<string, OutdatedDependencyInfo> = {}
  for (const [key, spec] of semverEntries) {
    const data = versionMap.get(spec.name)
    if (data?.distTags?.latest) {
      const info = resolveOutdated(data.versions, data.distTags.latest, spec.version)
      if (info) results[key] = info
    }
  }

  return results
}

/**
 * Check for outdated dependencies via fast-npm-meta batch version lookups.
 * Returns an AsyncData result.
 */
export function useOutdatedDependencies(
  dependencies: MaybeRefOrGetter<Record<string, DependencySpec> | undefined>,
) {
  const key = computed(() => {
    const deps = toValue(dependencies)
    if (!deps) return 'outdated:none'
    const sorted = Object.keys(deps).sort()
    return sorted.length === 0
      ? 'outdated:none'
      : `outdated:${sorted.map(k => `${k}@${deps[k]!.version}`).join(',')}`
  })

  return useAsyncData<Record<string, OutdatedDependencyInfo>>(
    key,
    async () => {
      const deps = toValue(dependencies)
      if (!deps || Object.keys(deps).length === 0) return {}
      return await fetchOutdatedMap(deps)
    },
    {
      watch: [key],
      default: () => ({}),
    },
  )
}
