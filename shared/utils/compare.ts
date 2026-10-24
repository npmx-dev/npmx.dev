import { parsePackageSpec } from './parse-package-param'

/** Special identifier for the "What Would James Do?" comparison column */
export const NO_DEPENDENCY_ID = '__no_dependency__'

const VERSION_COMPARISON_EXCLUDED_FACETS = [
  'downloads',
  'githubStars',
  'githubForks',
  'githubIssues',
  'totalLikes',
  'createdAt',
] as const

export function shouldHideFacetInVersionComparison(facetId: string): boolean {
  return (VERSION_COMPARISON_EXCLUDED_FACETS as readonly string[]).includes(facetId)
}

function getRealPackages(packages: string[]): string[] {
  return packages.filter(p => p !== NO_DEPENDENCY_ID)
}

export function getUniqueBasePackages(packages: string[]): string[] {
  return [...new Set(getRealPackages(packages).map(p => parsePackageSpec(p).name))]
}

export function isVersionComparison(packages: string[]): boolean {
  const real = getRealPackages(packages)
  const uniqueBase = getUniqueBasePackages(packages)
  return uniqueBase.length === 1 && real.length > 1
}
