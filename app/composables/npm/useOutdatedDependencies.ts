import type { PackageVersionsInfo } from 'fast-npm-meta'
import { getVersionsBatch } from 'fast-npm-meta'
import { maxSatisfying, prerelease, major, minor, diff, gt } from 'semver'
import {
  type OutdatedDependencyInfo,
  isNonSemverConstraint,
  constraintIncludesPrerelease,
} from '~/utils/npm/outdated-dependencies'

const BATCH_SIZE = 50

function resolveOutdated(
  versions: string[],
  latestTag: string,
  constraint: string,
): OutdatedDependencyInfo | null {
  if (constraint === 'latest') {
    return {
      resolved: latestTag,
      latest: latestTag,
      majorsBehind: 0,
      minorsBehind: 0,
      diffType: null,
    }
  }

  let filteredVersions = versions
  if (!constraintIncludesPrerelease(constraint)) {
    filteredVersions = versions.filter(v => !prerelease(v))
  }

  const resolved = maxSatisfying(filteredVersions, constraint)
  if (!resolved) return null

  if (resolved === latestTag) return null

  // Resolved is newer than latest (e.g. ^2.0.0-rc when latest is 1.x)
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
 * Check for outdated dependencies via fast-npm-meta batch version lookups.
 * Returns a reactive map of dependency name to outdated info.
 */
export function useOutdatedDependencies(
  dependencies: MaybeRefOrGetter<Record<string, string> | undefined>,
) {
  const outdated = shallowRef<Record<string, OutdatedDependencyInfo>>({})

  async function fetchOutdatedInfo(deps: Record<string, string> | undefined) {
    if (!deps || Object.keys(deps).length === 0) {
      outdated.value = {}
      return
    }

    const semverEntries = Object.entries(deps).filter(
      ([, constraint]) => !isNonSemverConstraint(constraint),
    )

    if (semverEntries.length === 0) {
      outdated.value = {}
      return
    }

    const packageNames = semverEntries.map(([name]) => name)

    const chunks: string[][] = []
    for (let i = 0; i < packageNames.length; i += BATCH_SIZE) {
      chunks.push(packageNames.slice(i, i + BATCH_SIZE))
    }
    const batchResults = await Promise.all(
      chunks.map(chunk => getVersionsBatch(chunk, { throw: false })),
    )
    const allVersionData = batchResults.flat()

    // Build a lookup map from package name to version data
    const versionMap = new Map<string, PackageVersionsInfo>()
    for (const data of allVersionData) {
      if ('error' in data) continue
      versionMap.set(data.name, data)
    }

    const results: Record<string, OutdatedDependencyInfo> = {}
    for (const [name, constraint] of semverEntries) {
      const data = versionMap.get(name)
      if (!data) continue

      const latestTag = data.distTags.latest
      if (!latestTag) continue

      const info = resolveOutdated(data.versions, latestTag, constraint)
      if (info) {
        results[name] = info
      }
    }

    outdated.value = results
  }

  watch(
    () => toValue(dependencies),
    deps => {
      fetchOutdatedInfo(deps).catch(() => {
        // Network failure or fast-npm-meta outage — leave stale results in place
      })
    },
    { immediate: true },
  )

  return outdated
}
