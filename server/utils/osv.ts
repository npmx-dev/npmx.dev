import type { OsvRange, OsvVulnerability } from '#shared/types/dependency-analysis'
import { isGreaterOrEqual, isLess, isLessOrEqual, isValidRange, satisfies } from 'verkit'

interface OsvInterval {
  introduced: string
  fixed?: string
  lastAffected?: string
}

/**
 * Parse OSV range events into introduced/fixed pairs.
 * OSV events form a timeline: [introduced, fixed, introduced, fixed, ...]
 * A single range can have multiple introduced/fixed pairs representing
 * periods where the vulnerability was active, was fixed, and was reintroduced.
 * @see https://ossf.github.io/osv-schema/#affectedrangesevents-fields
 */
export function parseRangeIntervals(range: OsvRange): OsvInterval[] {
  const intervals: OsvInterval[] = []
  let currentIntroduced: string | undefined

  for (const event of range.events) {
    if (event.introduced !== undefined) {
      // Start a new interval (close previous open one if any)
      if (currentIntroduced !== undefined) {
        intervals.push({ introduced: currentIntroduced })
      }
      currentIntroduced = event.introduced
    } else if (event.fixed !== undefined && currentIntroduced !== undefined) {
      intervals.push({ introduced: currentIntroduced, fixed: event.fixed })
      currentIntroduced = undefined
    } else if (event.last_affected !== undefined && currentIntroduced !== undefined) {
      intervals.push({ introduced: currentIntroduced, lastAffected: event.last_affected })
      currentIntroduced = undefined
    }
  }

  // Handle trailing introduced with no fixed (still vulnerable)
  if (currentIntroduced !== undefined) {
    intervals.push({ introduced: currentIntroduced })
  }

  return intervals
}

function isInInterval(version: string, interval: OsvInterval): boolean {
  const introduced = interval.introduced === '0' ? '0.0.0' : interval.introduced
  if (!isGreaterOrEqual(version, introduced)) return false
  if (interval.fixed) return isLess(version, interval.fixed)
  if (interval.lastAffected) return isLessOrEqual(version, interval.lastAffected)
  return true
}

/**
 * Whether OSV matched `version` only through open-ended intervals whose
 * `database_specific.last_known_affected_version_range` excludes it.
 * GitHub advisories store the upper bound of unpatched ranges there.
 * @see https://github.com/github/advisory-database/issues/470#issuecomment-1998604377
 */
export function isExcludedByLastKnownAffectedRange(
  vuln: OsvVulnerability,
  packageName: string,
  version: string,
): boolean {
  let excluded = false

  for (const entry of vuln.affected ?? []) {
    if (entry.package.ecosystem !== 'npm' || entry.package.name !== packageName) continue
    if (entry.versions?.includes(version)) return false

    const upperBound = entry.database_specific?.last_known_affected_version_range

    for (const range of entry.ranges ?? []) {
      if (range.type !== 'SEMVER' && range.type !== 'ECOSYSTEM') continue

      for (const interval of parseRangeIntervals(range)) {
        try {
          if (!isInInterval(version, interval)) continue
          if (interval.fixed || interval.lastAffected) return false
          if (!upperBound || !isValidRange(upperBound)) return false
          if (satisfies(version, upperBound, { includePrerelease: true })) return false
          excluded = true
        } catch {
          return false
        }
      }
    }
  }

  return excluded
}
