import { getTrustLevel, getTrustLevelName, type TrustLevelName } from 'packumeta'
import { compare, getMajor } from 'verkit'

export interface PublishSecurityDowngrade {
  downgradedVersion: string
  downgradedPublishedAt?: string
  downgradedTrustLevel: TrustLevelName
  /** Recommended trusted version within the same major, if one exists */
  trustedVersion?: string
  trustedPublishedAt?: string
  trustedTrustLevel: TrustLevelName
}

type VersionWithIndex = PackageVersionInfo & {
  index: number
  timestamp: number
  trustRank: number
  trustLevelName: TrustLevelName
}

function toTimestamp(time?: string): number {
  if (!time) return Number.NaN
  return Date.parse(time)
}

function sortByRecency(a: VersionWithIndex, b: VersionWithIndex): number {
  const aValid = !Number.isNaN(a.timestamp)
  const bValid = !Number.isNaN(b.timestamp)

  if (!aValid && !bValid) {
    // Fall back to semver comparison if no valid timestamps
    const semverOrder = compare(b.version, a.version)
    if (semverOrder !== 0) return semverOrder

    // If semver is also equal, maintain original order
    return a.index - b.index
  }

  if (aValid !== bValid) {
    return aValid ? -1 : 1
  }

  return b.timestamp - a.timestamp
}

/**
 * Detects a security downgrade for a specific viewed version.
 * A version is considered downgraded when it has no provenance and
 * there exists an older trusted release.
 */
export function detectPublishSecurityDowngradeForVersion(
  versions: PackageVersionInfo[],
  viewedVersion: string,
): PublishSecurityDowngrade | null {
  if (versions.length < 2 || !viewedVersion) return null

  const sorted = versions
    .map((version, index) => {
      return {
        ...version,
        index,
        timestamp: toTimestamp(version.time),
        trustRank: version.trustStatus ? getTrustLevel(version.trustStatus) : 0,
        trustLevelName: version.trustStatus ? getTrustLevelName(version.trustStatus) : 'none',
      }
    })
    .sort(sortByRecency)

  const currentIndex = sorted.findIndex(version => version.version === viewedVersion)
  if (currentIndex === -1) return null

  const current = sorted[currentIndex]
  if (!current) return null

  const currentMajor = getMajor(current.version)

  // Find the strongest older version across all majors (for detection)
  // and the strongest within the same major (for recommendation)
  let strongestOlderAny: VersionWithIndex | null = null
  let strongestOlderSameMajor: VersionWithIndex | null = null
  for (const version of sorted.slice(currentIndex + 1)) {
    // Skip deprecated versions — recommending a deprecated version is misleading
    if (version.deprecated) continue
    if (!strongestOlderAny || version.trustRank > strongestOlderAny.trustRank) {
      strongestOlderAny = version
    }
    if (getMajor(version.version) === currentMajor) {
      if (!strongestOlderSameMajor || version.trustRank > strongestOlderSameMajor.trustRank) {
        strongestOlderSameMajor = version
      }
    }
  }

  // Use same-major for recommendation if available; otherwise, any-major for detection only
  const strongestOlder = strongestOlderSameMajor ?? strongestOlderAny
  if (!strongestOlder || strongestOlder.trustRank <= current.trustRank) return null

  // Only recommend a specific version if it's in the same major
  const recommendation = strongestOlderSameMajor

  return {
    downgradedVersion: current.version,
    downgradedPublishedAt: current.time,
    downgradedTrustLevel: current.trustLevelName,
    trustedVersion: recommendation?.version,
    trustedPublishedAt: recommendation?.time,
    trustedTrustLevel: strongestOlder.trustLevelName,
  }
}
