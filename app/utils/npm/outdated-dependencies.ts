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

/** Parsed result of an npm dependency value */
export interface ParsedDepValue {
  /** The real package name (different from key only for aliases) */
  name: string | null
  /** The semver range or version, null for non-resolvable values (file:, git, etc.) */
  range: string | null
}

/**
 * Parse a dependency value which may be a semver range, an npm alias, or a non-semver reference.
 *
 * Examples:
 *   "^4.2.0"                    { name: null, range: "^4.2.0" }
 *   "npm:string-width@^4.2.0"   { name: "string-width", range: "^4.2.0" }
 *   "npm:@scope/pkg@^1.0.0"     { name: "@scope/pkg", range: "^1.0.0" }
 *   "file:../foo"               { name: null, range: null }
 */
export function parseDepValue(value: string): ParsedDepValue {
  if (value.startsWith('npm:')) {
    const aliasBody = value.slice(4) // strip "npm:"
    // Scoped: @scope/name@range
    if (aliasBody.startsWith('@')) {
      const secondAt = aliasBody.indexOf('@', 1)
      if (secondAt !== -1) {
        return { name: aliasBody.slice(0, secondAt), range: aliasBody.slice(secondAt + 1) }
      }
      return { name: aliasBody, range: null }
    }
    // Unscoped: name@range
    const atIndex = aliasBody.indexOf('@')
    if (atIndex !== -1) {
      return { name: aliasBody.slice(0, atIndex), range: aliasBody.slice(atIndex + 1) }
    }
    return { name: aliasBody, range: null }
  }

  if (isNonSemverConstraint(value)) {
    return { name: null, range: null }
  }

  return { name: null, range: value }
}

/**
 * Check if a constraint is a non-semver value (git URL, file path, etc.)
 */
function isNonSemverConstraint(constraint: string): boolean {
  return (
    constraint.startsWith('git') ||
    constraint.startsWith('http') ||
    constraint.startsWith('file:') ||
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
    return 'text-green-700 dark:text-green-500 cursor-help'
  }
  // Red for major versions behind
  if (info.majorsBehind > 0) return 'text-red-700 dark:text-red-500 cursor-help'
  // if (info.majorsBehind > 0) return 'text-#db0000 dark:text-red-500 cursor-help'
  // Orange for minor versions behind
  if (info.minorsBehind > 0) return 'text-orange-700 dark:text-orange-500 cursor-help'
  // Yellow for patch versions behind
  return 'text-yellow-700 dark:text-yellow-500 cursor-help'
}
