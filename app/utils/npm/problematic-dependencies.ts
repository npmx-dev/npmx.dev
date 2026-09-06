import type { VersionDifference } from 'verkit'
import type { PackageDependencyInsights } from '../../composables/usePackageDependencyInsights'

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
  diffType: VersionDifference | null
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
export function getVersionClass(
  dep: string,
  insights: Pick<PackageDependencyInsights, 'outdatedDeps' | 'replacementDeps'> | undefined,
): string {
  const outdated = insights?.outdatedDeps.value?.[dep]
  if (!outdated) {
    // Amber for replacements (not outdated)
    if (insights?.replacementDeps.value?.[dep]) {
      return 'text-amber-700 dark:text-amber-500'
    }
    // Normal
    return 'text-fg-subtle'
  }
  // Red for major versions behind
  if (outdated.majorsBehind > 0) return 'text-red-700 dark:text-red-500'
  // if (info.majorsBehind > 0) return 'text-#db0000 dark:text-red-500'
  // Orange for minor versions behind
  if (outdated.minorsBehind > 0) return 'text-orange-700 dark:text-orange-500'
  // Yellow for patch versions behind
  return 'text-yellow-700 dark:text-yellow-500'
}

export function getVulnerableDepInfo(
  depName: string,
  vulnTree: VulnerabilityTreeResult | undefined,
) {
  if (!vulnTree?.vulnerablePackages) return null
  return vulnTree.vulnerablePackages.find(
    p => p.name === depName && (p.depth === 'root' || p.depth === 'direct'),
  )
}

export function getDeprecatedDepInfo(
  depName: string,
  vulnTree: VulnerabilityTreeResult | undefined,
  fallbackDeprecated?: string | boolean,
) {
  if (vulnTree?.deprecatedPackages) {
    const found = vulnTree.deprecatedPackages.find(
      p => p.name === depName && (p.depth === 'root' || p.depth === 'direct'),
    )
    if (found) return found
  }
  if (fallbackDeprecated) {
    return {
      name: depName,
      version: '',
      depth: 'root' as const,
      path: [depName],
      message: typeof fallbackDeprecated === 'string' ? fallbackDeprecated : '',
    }
  }
  return null
}
