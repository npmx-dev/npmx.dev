/**
 * Comparison feature types
 */

/** Available comparison facets */
export type ComparisonFacet =
  | 'downloads'
  | 'packageSize'
  | 'installSize'
  | 'moduleFormat'
  | 'types'
  | 'engines'
  | 'vulnerabilities'
  | 'lastUpdated'
  | 'license'
  | 'dependencies'
  | 'totalDependencies'
  | 'deprecated'
  | 'totalLikes'

/** Facet metadata for UI display */
export interface FacetInfo {
  id: ComparisonFacet
  category: 'performance' | 'health' | 'compatibility' | 'security'
  comingSoon?: boolean
}

/** Category display order */
export const CATEGORY_ORDER = ['performance', 'health', 'compatibility', 'security'] as const

/** All available facets with their metadata (ordered by category, then display order within category) */
export const FACET_INFO: Record<ComparisonFacet, Omit<FacetInfo, 'id'>> = {
  // Performance
  packageSize: {
    category: 'performance',
  },
  installSize: {
    category: 'performance',
  },
  dependencies: {
    category: 'performance',
  },
  totalDependencies: {
    category: 'performance',
  },
  // Health
  downloads: {
    category: 'health',
  },
  totalLikes: {
    category: 'health',
  },
  lastUpdated: {
    category: 'health',
  },
  deprecated: {
    category: 'health',
  },
  // Compatibility
  engines: {
    category: 'compatibility',
  },
  types: {
    category: 'compatibility',
  },
  moduleFormat: {
    category: 'compatibility',
  },
  // Security
  license: {
    category: 'security',
  },
  vulnerabilities: {
    category: 'security',
  },
}

/** All facets in display order */
export const ALL_FACETS: ComparisonFacet[] = Object.keys(FACET_INFO) as ComparisonFacet[]

/** Facets grouped by category (derived from FACET_INFO) */
export const FACETS_BY_CATEGORY: Record<FacetInfo['category'], ComparisonFacet[]> =
  ALL_FACETS.reduce(
    (acc, facet) => {
      acc[FACET_INFO[facet].category].push(facet)
      return acc
    },
    { performance: [], health: [], compatibility: [], security: [] } as Record<
      FacetInfo['category'],
      ComparisonFacet[]
    >,
  )

/** Default facets - all non-comingSoon facets */
export const DEFAULT_FACETS: ComparisonFacet[] = ALL_FACETS.filter(f => !FACET_INFO[f].comingSoon)

/** Facet value that can be compared */
export interface FacetValue<T = unknown> {
  /** Raw value for comparison logic */
  raw: T
  /** Formatted display string (or ISO date string if type is 'date') */
  display: string
  /** Optional status indicator */
  status?: 'good' | 'info' | 'warning' | 'bad' | 'neutral' | 'muted'
  /** Value type for special rendering (e.g., dates use DateTime component) */
  type?: 'date'
  /** Optional tooltip text to explain the value */
  tooltip?: string
}

/** Package data for comparison */
export interface ComparisonPackage {
  name: string
  version: string
  description?: string
}

// ComingSoon tests run only when FACET_INFO has at least one comingSoon facet
export const comingSoonFacets = (Object.keys(FACET_INFO) as ComparisonFacet[]).filter(
  f => FACET_INFO[f].comingSoon,
)
export const hasComingSoonFacets = comingSoonFacets.length > 0
