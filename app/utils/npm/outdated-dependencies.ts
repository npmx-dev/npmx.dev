import type { ReleaseType } from 'semver'

/** Information about an outdated dependency */
export interface OutdatedDependencyInfo {
  /** The resolved version that satisfies the constraint */
  resolved: string
  /** The latest available version */
  latest: string
  /** How many major versions behind */
  majorsBehind: number
  /** How many minor versions behind (when same major) */
  minorsBehind: number
  /** The type of version difference */
  diffType: ReleaseType | null
}

/**
 * Check if a version constraint explicitly includes a prerelease tag.
 * e.g., "^1.0.0-alpha" or ">=2.0.0-beta.1" include prereleases
 */
export function constraintIncludesPrerelease(constraint: string): boolean {
  return (
    /-(?:alpha|beta|rc|next|canary|dev|preview|pre|experimental)/i.test(constraint) ||
    /-\d/.test(constraint)
  )
}

/**
 * Check if a constraint is a non-semver value (git URL, file path, etc.)
 */
export function isNonSemverConstraint(constraint: string): boolean {
  return (
    constraint.startsWith('git') ||
    constraint.startsWith('http') ||
    constraint.startsWith('file:') ||
    constraint.startsWith('npm:') ||
    constraint.startsWith('link:') ||
    constraint.startsWith('workspace:') ||
    constraint.includes('/')
  )
}

/**
 * Get tooltip text for an outdated dependency
 */
export function getOutdatedTooltip(
  info: OutdatedDependencyInfo,
  t: (key: string, params?: Record<string, unknown>, plural?: number) => string,
): string {
  if (info.majorsBehind > 0) {
    return t(
      'package.dependencies.outdated_major',
      { count: info.majorsBehind, latest: info.latest },
      info.majorsBehind,
    )
  }
  if (info.minorsBehind > 0) {
    return t(
      'package.dependencies.outdated_minor',
      { count: info.minorsBehind, latest: info.latest },
      info.minorsBehind,
    )
  }
  return t('package.dependencies.outdated_patch', { latest: info.latest })
}

/**
 * Get CSS class for a dependency version based on outdated status
 */
export function getVersionClass(info: OutdatedDependencyInfo | undefined): string {
  if (!info) return 'text-fg-subtle'
  // Green for up-to-date (e.g. "latest" constraint)
  if (info.majorsBehind === 0 && info.minorsBehind === 0 && info.resolved === info.latest) {
    return 'text-green-500 cursor-help'
  }
  // Red for major versions behind
  if (info.majorsBehind > 0) return 'text-red-500 cursor-help'
  // Orange for minor versions behind
  if (info.minorsBehind > 0) return 'text-orange-500 cursor-help'
  // Yellow for patch versions behind
  return 'text-yellow-500 cursor-help'
}
