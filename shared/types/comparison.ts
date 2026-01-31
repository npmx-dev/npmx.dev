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

/** Facet metadata for UI display */
export interface FacetInfo {
  id: ComparisonFacet
  label: string
  description: string
  category: 'performance' | 'health' | 'compatibility' | 'security'
  comingSoon?: boolean
}

/** Category display order */
export const CATEGORY_ORDER = ['performance', 'health', 'compatibility', 'security'] as const

/** All available facets with their metadata (ordered by category, then display order within category) */
export const FACET_INFO: Record<ComparisonFacet, Omit<FacetInfo, 'id'>> = {
  // Performance
  packageSize: {
    label: 'Package Size',
    description: 'Size of the package itself (unpacked)',
    category: 'performance',
  },
  installSize: {
    label: 'Install Size',
    description: 'Total install size including all dependencies',
    category: 'performance',
  },
  dependencies: {
    label: '# Direct Deps',
    description: 'Number of direct dependencies',
    category: 'performance',
  },
  totalDependencies: {
    label: '# Total Deps',
    description: 'Total number of dependencies including transitive',
    category: 'performance',
    comingSoon: true,
  },
  // Health
  downloads: {
    label: 'Downloads/wk',
    description: 'Weekly download count',
    category: 'health',
  },
  lastUpdated: {
    label: 'Last Updated',
    description: 'Most recent publish date',
    category: 'health',
  },
  deprecated: {
    label: 'Deprecated?',
    description: 'Whether the package is deprecated',
    category: 'health',
  },
  // Compatibility
  engines: {
    label: 'Engines',
    description: 'Node.js version requirements',
    category: 'compatibility',
  },
  types: {
    label: 'Types',
    description: 'TypeScript type definitions',
    category: 'compatibility',
  },
  moduleFormat: {
    label: 'Module Format',
    description: 'ESM/CJS support',
    category: 'compatibility',
  },
  // Security
  license: {
    label: 'License',
    description: 'Package license',
    category: 'security',
  },
  vulnerabilities: {
    label: 'Vulnerabilities',
    description: 'Known security vulnerabilities',
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
  status?: 'good' | 'info' | 'warning' | 'bad' | 'neutral'
  /** Value type for special rendering (e.g., dates use DateTime component) */
  type?: 'date'
}

/** Package data for comparison */
export interface ComparisonPackage {
  name: string
  version: string
  description?: string
}
