import type { PackageVersionInfo, PublishTrustLevel } from '#shared/types'
import { compare, major } from 'semver'

export interface PublishSecurityDowngrade {
  downgradedVersion: string
  downgradedPublishedAt?: string
  downgradedTrustLevel: PublishTrustLevel
  /** Recommended trusted version within the same major, if one exists */
  trustedVersion?: string
  trustedPublishedAt?: string
  trustedTrustLevel: PublishTrustLevel
}

type VersionWithIndex = PackageVersionInfo & {
  index: number
  timestamp: number
  trustRank: number
  resolvedTrustLevel: PublishTrustLevel
}

const TRUST_RANK: Record<PublishTrustLevel, number> = {
  none: 0,
  provenance: 1,
  trustedPublisher: 2,
}

function resolveTrustLevel(version: PackageVersionInfo): PublishTrustLevel {
  if (version.trustLevel) return version.trustLevel
  // Fallback for legacy data: hasProvenance only indicates non-'none' trust,
  // so map it to provenance (the lower rank) to avoid over-ranking
  return version.hasProvenance ? 'provenance' : 'none'
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
      const resolvedTrustLevel = resolveTrustLevel(version)
      return {
        ...version,
        index,
        timestamp: toTimestamp(version.time),
        trustRank: TRUST_RANK[resolvedTrustLevel],
        resolvedTrustLevel,
      }
    })
    .sort(sortByRecency)

  const currentIndex = sorted.findIndex(version => version.version === viewedVersion)
  if (currentIndex === -1) return null

  const current = sorted[currentIndex]
  if (!current) return null

  const currentMajor = major(current.version)

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
    if (major(version.version) === currentMajor) {
      if (!strongestOlderSameMajor || version.trustRank > strongestOlderSameMajor.trustRank) {
        strongestOlderSameMajor = version
      }
    }
  }

  // Use same-major for recommendation if available, otherwise any-major for detection only
  const strongestOlder = strongestOlderSameMajor ?? strongestOlderAny
  if (!strongestOlder || strongestOlder.trustRank <= current.trustRank) return null

  // Only recommend a specific version if it's in the same major
  const recommendation = strongestOlderSameMajor

  return {
    downgradedVersion: current.version,
    downgradedPublishedAt: current.time,
    downgradedTrustLevel: current.resolvedTrustLevel,
    trustedVersion: recommendation?.version,
    trustedPublishedAt: recommendation?.time,
    trustedTrustLevel: strongestOlder.resolvedTrustLevel,
  }
}
