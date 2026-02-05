import type { PackageVersionInfo } from '#shared/types'
import { compare } from 'semver'

export interface PublishSecurityDowngrade {
  downgradedVersion: string
  downgradedPublishedAt?: string
  trustedVersion: string
  trustedPublishedAt?: string
}

type VersionWithIndex = PackageVersionInfo & {
  index: number
  timestamp: number
}

function toTimestamp(time?: string): number {
  if (!time) return Number.NaN
  return Date.parse(time)
}

function sortByRecency(a: VersionWithIndex, b: VersionWithIndex): number {
  const aValid = Number.isFinite(a.timestamp)
  const bValid = Number.isFinite(b.timestamp)

  if (aValid && bValid && a.timestamp !== b.timestamp) {
    return b.timestamp - a.timestamp
  }

  if (aValid !== bValid) {
    return aValid ? -1 : 1
  }

  const semverOrder = compare(b.version, a.version)
  if (semverOrder !== 0) return semverOrder

  return a.index - b.index
}

/**
 * Detects a security downgrade where the newest publish is not trusted,
 * but an older publish was trusted (e.g. OIDC/provenance -> manual publish).
 */
export function detectPublishSecurityDowngrade(
  versions: PackageVersionInfo[],
): PublishSecurityDowngrade | null {
  if (versions.length < 2) return null

  const sorted = versions
    .map((version, index) => ({
      ...version,
      index,
      timestamp: toTimestamp(version.time),
    }))
    .sort(sortByRecency)

  const latest = sorted.at(0)
  if (!latest || latest.hasProvenance) return null

  const latestTrusted = sorted.find(version => version.hasProvenance)
  if (!latestTrusted) return null

  return {
    downgradedVersion: latest.version,
    downgradedPublishedAt: latest.time,
    trustedVersion: latestTrusted.version,
    trustedPublishedAt: latestTrusted.time,
  }
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
    .map((version, index) => ({
      ...version,
      index,
      timestamp: toTimestamp(version.time),
    }))
    .sort(sortByRecency)

  const currentIndex = sorted.findIndex(version => version.version === viewedVersion)
  if (currentIndex === -1) return null

  const current = sorted.at(currentIndex)
  if (!current || current.hasProvenance) return null

  const trustedOlder = sorted.slice(currentIndex + 1).find(version => version.hasProvenance)
  if (!trustedOlder) return null

  return {
    downgradedVersion: current.version,
    downgradedPublishedAt: current.time,
    trustedVersion: trustedOlder.version,
    trustedPublishedAt: trustedOlder.time,
  }
}
