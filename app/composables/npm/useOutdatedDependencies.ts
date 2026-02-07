import type { NuxtApp } from '#app'
import { maxSatisfying, prerelease, major, minor, diff, gt } from 'semver'
import type { Packument } from '#shared/types'
import { mapWithConcurrency } from '#shared/utils/async'
import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'
import {
  type OutdatedDependencyInfo,
  isNonSemverConstraint,
  constraintIncludesPrerelease,
} from '~/utils/npm/outdated-dependencies'

// Cache for packument fetches to avoid duplicate requests across components
const packumentCache = new Map<string, Promise<Packument | null>>()

/**
 * Check if a dependency is outdated.
 * Returns null if up-to-date or if we can't determine.
 */
async function checkDependencyOutdated(
  cachedFetch: CachedFetchFunction,
  $npmRegistry: NuxtApp['$npmRegistry'],
  packageName: string,
  constraint: string,
): Promise<OutdatedDependencyInfo | null> {
  if (isNonSemverConstraint(constraint)) {
    return null
  }

  // Check in-memory cache first
  let packument: Packument | null
  const cached = packumentCache.get(packageName)
  if (cached) {
    packument = await cached
  } else {
    const promise = $npmRegistry<Packument>(`/${encodePackageName(packageName)}`)
      .then(({ data }) => data)
      .catch(() => null)
    packumentCache.set(packageName, promise)
    packument = await promise
  }

  if (!packument) return null

  const latestTag = packument['dist-tags']?.latest
  if (!latestTag) return null

  // Handle "latest" constraint specially - return info with current version
  if (constraint === 'latest') {
    return {
      resolved: latestTag,
      latest: latestTag,
      majorsBehind: 0,
      minorsBehind: 0,
      diffType: null,
    }
  }

  let versions = Object.keys(packument.versions)
  const includesPrerelease = constraintIncludesPrerelease(constraint)

  if (!includesPrerelease) {
    versions = versions.filter(v => !prerelease(v))
  }

  const resolved = maxSatisfying(versions, constraint)
  if (!resolved) return null

  if (resolved === latestTag) return null

  // If resolved version is newer than latest, not outdated
  // (e.g., using ^2.0.0-rc when latest is 1.x)
  if (gt(resolved, latestTag)) {
    return null
  }

  const diffType = diff(resolved, latestTag)
  const majorsBehind = major(latestTag) - major(resolved)
  const minorsBehind = majorsBehind === 0 ? minor(latestTag) - minor(resolved) : 0

  return {
    resolved,
    latest: latestTag,
    majorsBehind,
    minorsBehind,
    diffType,
  }
}

/**
 * Composable to check for outdated dependencies.
 * Returns a reactive map of dependency name to outdated info.
 */
export function useOutdatedDependencies(
  dependencies: MaybeRefOrGetter<Record<string, string> | undefined>,
) {
  const { $npmRegistry } = useNuxtApp()
  const cachedFetch = useCachedFetch()
  const outdated = shallowRef<Record<string, OutdatedDependencyInfo>>({})

  async function fetchOutdatedInfo(deps: Record<string, string> | undefined) {
    if (!deps || Object.keys(deps).length === 0) {
      outdated.value = {}
      return
    }

    const entries = Object.entries(deps)
    const batchResults = await mapWithConcurrency(
      entries,
      async ([name, constraint]) => {
        const info = await checkDependencyOutdated(cachedFetch, $npmRegistry, name, constraint)
        return [name, info] as const
      },
      5,
    )

    const results: Record<string, OutdatedDependencyInfo> = {}
    for (const [name, info] of batchResults) {
      if (info) {
        results[name] = info
      }
    }

    outdated.value = results
  }

  watch(
    () => toValue(dependencies),
    deps => {
      fetchOutdatedInfo(deps)
    },
    { immediate: true },
  )

  return outdated
}
