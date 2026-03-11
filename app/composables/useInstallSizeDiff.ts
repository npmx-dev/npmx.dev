import { compare, prerelease, valid } from 'semver'
import type { InstallSizeResult, SlimPackument } from '#shared/types'

export interface InstallSizeDiff {
  comparisonVersion: string
  sizeRatio: number
  sizeIncrease: number
  currentSize: number
  previousSize: number
  depDiff: number
  currentDeps: number
  previousDeps: number
  sizeThresholdExceeded: boolean
  depThresholdExceeded: boolean
}

const SIZE_INCREASE_THRESHOLD = 0.25
const DEP_INCREASE_THRESHOLD = 5

function getComparisonVersion(pkg: SlimPackument, resolvedVersion: string): string | null {
  const isCurrentPrerelease = prerelease(resolvedVersion) !== null

  if (isCurrentPrerelease) {
    const latest = pkg['dist-tags']?.latest
    if (!latest || latest === resolvedVersion) return null
    return latest
  }

  // Find the previous version in time that was stable
  const stableVersions = Object.keys(pkg.time)
    .filter(v => v !== 'modified' && v !== 'created' && valid(v) !== null && prerelease(v) === null)
    .sort((a, b) => compare(a, b))

  const currentIdx = stableVersions.indexOf(resolvedVersion)
  if (currentIdx <= 0) return null

  return stableVersions[currentIdx - 1]!
}

export function useInstallSizeDiff(
  packageName: MaybeRefOrGetter<string>,
  resolvedVersion: MaybeRefOrGetter<string | null | undefined>,
  pkg: MaybeRefOrGetter<SlimPackument | null | undefined>,
  currentInstallSize: MaybeRefOrGetter<InstallSizeResult | null | undefined>,
) {
  const comparisonVersion = computed<string | null>(() => {
    const pkgVal = toValue(pkg)
    const version = toValue(resolvedVersion)
    if (!pkgVal || !version) return null
    return getComparisonVersion(pkgVal, version)
  })

  const {
    data: comparisonInstallSize,
    status: comparisonStatus,
    execute: fetchComparisonSize,
  } = useLazyFetch<InstallSizeResult | null>(
    () => {
      const v = comparisonVersion.value
      if (!v) return ''
      return `/api/registry/install-size/${toValue(packageName)}/v/${v}`
    },
    {
      server: false,
      immediate: false,
      default: () => null,
    },
  )

  if (import.meta.client) {
    watch(
      [comparisonVersion, () => toValue(packageName)],
      ([v]) => {
        if (v) fetchComparisonSize()
      },
      { immediate: true },
    )
  }

  const diff = computed<InstallSizeDiff | null>(() => {
    const current = toValue(currentInstallSize)
    const previous = comparisonInstallSize.value
    const cv = comparisonVersion.value

    if (!current || !previous || !cv) return null
    const name = toValue(packageName)
    const version = toValue(resolvedVersion)
    if (previous.version !== cv || previous.package !== name) return null
    if (current.version !== version || current.package !== name) return null

    const sizeRatio =
      previous.totalSize > 0 ? (current.totalSize - previous.totalSize) / previous.totalSize : 0
    const depDiff = current.dependencyCount - previous.dependencyCount

    const sizeThresholdExceeded = sizeRatio > SIZE_INCREASE_THRESHOLD
    const depThresholdExceeded = depDiff > DEP_INCREASE_THRESHOLD

    if (!sizeThresholdExceeded && !depThresholdExceeded) return null

    return {
      comparisonVersion: cv,
      sizeRatio,
      sizeIncrease: current.totalSize - previous.totalSize,
      currentSize: current.totalSize,
      previousSize: previous.totalSize,
      depDiff,
      currentDeps: current.dependencyCount,
      previousDeps: previous.dependencyCount,
      sizeThresholdExceeded,
      depThresholdExceeded,
    }
  })

  return { diff, comparisonVersion, comparisonStatus }
}
