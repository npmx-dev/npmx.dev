import semver from 'semver'
import type {
  VersionDownloadPoint,
  VersionGroupDownloads,
  VersionGroupingMode,
} from '#shared/types'

/**
 * Intermediate data structure for version processing
 */
interface ProcessedVersion {
  version: string
  downloads: number
  major: number
  minor: number
  parsed: semver.SemVer
}

/**
 * Filter out versions below a usage threshold
 * @param versions Array of version download points
 * @param thresholdPercent Minimum percentage to include (default: 0.1%)
 * @returns Filtered array of versions
 */
export function filterLowUsageVersions(
  versions: VersionDownloadPoint[],
  thresholdPercent: number = 0.1,
): VersionDownloadPoint[] {
  return versions.filter(v => v.percentage >= thresholdPercent)
}

/**
 * Parse and validate version strings, calculating total downloads
 * @param rawDownloads Raw download data from npm API
 * @returns Array of processed versions with parsed semver data
 */
function parseVersions(rawDownloads: Record<string, number>): ProcessedVersion[] {
  const processed: ProcessedVersion[] = []

  for (const [version, downloads] of Object.entries(rawDownloads)) {
    const parsed = semver.parse(version)
    if (!parsed) continue

    processed.push({
      version,
      downloads,
      major: parsed.major,
      minor: parsed.minor,
      parsed,
    })
  }

  processed.sort((a, b) => semver.rcompare(a.version, b.version))

  return processed
}

/**
 * Calculate percentage for each version
 * @param versions Processed versions
 * @param totalDownloads Total download count
 * @returns Array of version download points with percentages
 */
function addPercentages(
  versions: ProcessedVersion[],
  totalDownloads: number,
): VersionDownloadPoint[] {
  return versions.map(v => ({
    version: v.version,
    downloads: v.downloads,
    percentage: totalDownloads > 0 ? (v.downloads / totalDownloads) * 100 : 0,
  }))
}

/**
 * Group versions by major version (e.g., 1.x, 2.x)
 * @param rawDownloads Raw download data from npm API
 * @returns Array of version groups sorted by downloads descending
 */
export function groupByMajor(rawDownloads: Record<string, number>): VersionGroupDownloads[] {
  const processed = parseVersions(rawDownloads)
  const totalDownloads = processed.reduce((sum, v) => sum + v.downloads, 0)

  const groups = new Map<number, ProcessedVersion[]>()
  for (const version of processed) {
    const existing = groups.get(version.major) || []
    existing.push(version)
    groups.set(version.major, existing)
  }

  const result: VersionGroupDownloads[] = []
  for (const [major, versions] of groups.entries()) {
    const groupDownloads = versions.reduce((sum, v) => sum + v.downloads, 0)
    const percentage = totalDownloads > 0 ? (groupDownloads / totalDownloads) * 100 : 0

    result.push({
      groupKey: `${major}.x`,
      label: `v${major}.x`,
      downloads: groupDownloads,
      percentage,
      versions: addPercentages(versions, totalDownloads),
    })
  }

  result.sort((a, b) => b.downloads - a.downloads)

  return result
}

/**
 * Group versions by major.minor (e.g., 1.2.x, 1.3.x)
 * Special handling for 0.x versions - treat them as separate majors
 * @param rawDownloads Raw download data from npm API
 * @returns Array of version groups sorted by downloads descending
 */
export function groupByMinor(rawDownloads: Record<string, number>): VersionGroupDownloads[] {
  const processed = parseVersions(rawDownloads)
  const totalDownloads = processed.reduce((sum, v) => sum + v.downloads, 0)

  // Group by major.minor
  const groups = new Map<string, ProcessedVersion[]>()
  for (const version of processed) {
    // For 0.x versions, treat each minor as significant (0.9.x, 0.10.x are different)
    // For 1.x+, group by major.minor normally
    const groupKey = `${version.major}.${version.minor}`
    const existing = groups.get(groupKey) || []
    existing.push(version)
    groups.set(groupKey, existing)
  }

  // Convert to VersionGroupDownloads
  const result: VersionGroupDownloads[] = []
  for (const [groupKey, versions] of groups.entries()) {
    const groupDownloads = versions.reduce((sum, v) => sum + v.downloads, 0)
    const percentage = totalDownloads > 0 ? (groupDownloads / totalDownloads) * 100 : 0

    result.push({
      groupKey: `${groupKey}.x`,
      label: `v${groupKey}.x`,
      downloads: groupDownloads,
      percentage,
      versions: addPercentages(versions, totalDownloads),
    })
  }

  result.sort((a, b) => b.downloads - a.downloads)

  return result
}

/**
 * Group versions by the specified mode
 * @param rawDownloads Raw download data from npm API
 * @param mode Grouping mode ('major' or 'minor')
 * @returns Array of version groups sorted by downloads descending
 */
export function groupVersionDownloads(
  rawDownloads: Record<string, number>,
  mode: VersionGroupingMode,
): VersionGroupDownloads[] {
  switch (mode) {
    case 'major':
      return groupByMajor(rawDownloads)
    case 'minor':
      return groupByMinor(rawDownloads)
    default:
      throw new Error(`Invalid grouping mode: ${mode}`)
  }
}
