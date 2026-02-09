/**
 * Package list preferences types
 * Used for configurable columns, filtering, sorting, and pagination
 */

// View modes
export type ViewMode = 'cards' | 'table'

// Column identifiers for table view
export type ColumnId =
  | 'name'
  | 'version'
  | 'description'
  | 'downloads'
  | 'updated'
  | 'maintainers'
  | 'keywords'
  | 'qualityScore'
  | 'popularityScore'
  | 'maintenanceScore'
  | 'combinedScore'
  | 'security'

export interface ColumnConfig {
  id: ColumnId
  visible: boolean
  sortable: boolean
  width?: string
  /** Whether the column is disabled (not yet available) */
  disabled?: boolean
}

// Default column configuration
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', visible: true, sortable: true, width: 'minmax(200px, 1fr)' },
  { id: 'version', visible: true, sortable: false, width: '100px' },
  {
    id: 'description',
    visible: true,
    sortable: false,
    width: 'minmax(200px, 2fr)',
  },
  { id: 'downloads', visible: true, sortable: true, width: '120px' },
  { id: 'updated', visible: true, sortable: true, width: '120px' },
  { id: 'maintainers', visible: false, sortable: false, width: '150px' },
  { id: 'keywords', visible: false, sortable: false, width: '200px' },
  {
    id: 'qualityScore',
    visible: false,
    sortable: true,
    width: '100px',
    disabled: true,
  },
  {
    id: 'popularityScore',
    visible: false,
    sortable: true,
    width: '100px',
    disabled: true,
  },
  {
    id: 'maintenanceScore',
    visible: false,
    sortable: true,
    width: '100px',
    disabled: true,
  },
  {
    id: 'combinedScore',
    visible: false,
    sortable: true,
    width: '100px',
    disabled: true,
  },
  {
    id: 'security',
    visible: false,
    sortable: false,
    width: '80px',
    disabled: true,
  },
]

// Sort keys (without direction)
export type SortKey =
  | 'downloads-week'
  | 'downloads-day'
  | 'downloads-month'
  | 'downloads-year'
  | 'updated'
  | 'name'
  | 'quality'
  | 'popularity'
  | 'maintenance'
  | 'score'
  | 'relevance'

export type SortDirection = 'asc' | 'desc'

// Combined sort option (key + direction)
export type SortOption =
  | 'downloads-week-desc'
  | 'downloads-week-asc'
  | 'downloads-day-desc'
  | 'downloads-day-asc'
  | 'downloads-month-desc'
  | 'downloads-month-asc'
  | 'downloads-year-desc'
  | 'downloads-year-asc'
  | 'updated-desc'
  | 'updated-asc'
  | 'name-asc'
  | 'name-desc'
  | 'quality-desc'
  | 'quality-asc'
  | 'popularity-desc'
  | 'popularity-asc'
  | 'maintenance-desc'
  | 'maintenance-asc'
  | 'score-desc'
  | 'score-asc'
  | 'relevance-desc'
  | 'relevance-asc'

export interface SortKeyConfig {
  key: SortKey
  /** Default direction for this sort key */
  defaultDirection: SortDirection
  /** Whether the sort option is disabled (not yet available) */
  disabled?: boolean
  /** Only show this sort option in search context */
  searchOnly?: boolean
}

export const SORT_KEYS: SortKeyConfig[] = [
  { key: 'relevance', defaultDirection: 'desc', searchOnly: true },
  { key: 'downloads-week', defaultDirection: 'desc' },
  { key: 'downloads-day', defaultDirection: 'desc', disabled: true },
  { key: 'downloads-month', defaultDirection: 'desc', disabled: true },
  { key: 'downloads-year', defaultDirection: 'desc', disabled: true },
  { key: 'updated', defaultDirection: 'desc' },
  { key: 'name', defaultDirection: 'asc' },
  // quality/popularity/maintenance: npm returns 1 for all, Algolia returns synthetic values.
  // Neither provider produces meaningful values for these.
  { key: 'quality', defaultDirection: 'desc', disabled: true },
  { key: 'popularity', defaultDirection: 'desc', disabled: true },
  { key: 'maintenance', defaultDirection: 'desc', disabled: true },
  // score.final === searchScore (identical to relevance), redundant sort key
  { key: 'score', defaultDirection: 'desc', disabled: true },
]

/**
 * Sort keys each search provider can meaningfully sort by.
 *
 * Both providers support: relevance (server-side order), updated, name.
 *
 * Algolia: has `downloadsLast30Days` for download sorting.
 *
 * npm: the search API now includes `downloads.weekly` and `downloads.monthly`
 * directly in results, so download sorting works here too.
 *
 * Neither provider returns useful quality/popularity/maintenance/score values:
 * - npm returns 1 for all detail scores, and score.final === searchScore (= relevance)
 * - Algolia returns synthetic values (quality: 0|1, maintenance: 0, score: 0)
 */
export const PROVIDER_SORT_KEYS: Record<'algolia' | 'npm', Set<SortKey>> = {
  algolia: new Set<SortKey>(['relevance', 'downloads-week', 'updated', 'name']),
  npm: new Set<SortKey>(['relevance', 'downloads-week', 'updated', 'name']),
}

/** All valid sort keys for validation */
const VALID_SORT_KEYS = new Set<SortKey>([
  'relevance',
  'downloads-week',
  'downloads-day',
  'downloads-month',
  'downloads-year',
  'updated',
  'name',
  'quality',
  'popularity',
  'maintenance',
  'score',
])

/** Parse a SortOption into key and direction */
export function parseSortOption(option: SortOption): {
  key: SortKey
  direction: SortDirection
} {
  const match = option.match(/^(.+)-(asc|desc)$/)
  if (match) {
    const key = match[1]
    const direction = match[2] as SortDirection
    // Validate that the key is a known sort key
    if (VALID_SORT_KEYS.has(key as SortKey)) {
      return { key: key as SortKey, direction }
    }
  }
  // Fallback to default sort option
  return { key: 'downloads-week', direction: 'desc' }
}

/** Build a SortOption from key and direction */
export function buildSortOption(key: SortKey, direction: SortDirection): SortOption {
  return `${key}-${direction}` as SortOption
}

/** Get the opposite direction */
export function toggleDirection(direction: SortDirection): SortDirection {
  return direction === 'asc' ? 'desc' : 'asc'
}

// Download range presets
export type DownloadRange = 'any' | 'lt100' | '100-1k' | '1k-10k' | '10k-100k' | 'gt100k'

export interface DownloadRangeConfig {
  value: DownloadRange
  min?: number
  max?: number
}

export const DOWNLOAD_RANGES: DownloadRangeConfig[] = [
  { value: 'any' },
  { value: 'lt100', max: 100 },
  { value: '100-1k', min: 100, max: 1000 },
  { value: '1k-10k', min: 1000, max: 10000 },
  { value: '10k-100k', min: 10000, max: 100000 },
  { value: 'gt100k', min: 100000 },
]

// Updated within presets
export type UpdatedWithin = 'any' | 'week' | 'month' | 'quarter' | 'year'

export interface UpdatedWithinConfig {
  value: UpdatedWithin
  days?: number
}

export const UPDATED_WITHIN_OPTIONS: UpdatedWithinConfig[] = [
  { value: 'any' },
  { value: 'week', days: 7 },
  { value: 'month', days: 30 },
  { value: 'quarter', days: 90 },
  { value: 'year', days: 365 },
]

// Security filter options
export type SecurityFilter = 'all' | 'secure' | 'warnings'

/** Security filter values - labels are in i18n under filters.security_options */
export const SECURITY_FILTER_VALUES: SecurityFilter[] = ['all', 'secure', 'warnings']

// Search scope options
export type SearchScope = 'name' | 'description' | 'keywords' | 'all'

/** Search scope values - labels are in i18n under filters.scope_* */
export const SEARCH_SCOPE_VALUES: SearchScope[] = ['name', 'description', 'keywords', 'all']

// Structured filters state
export interface StructuredFilters {
  text: string
  searchScope: SearchScope
  downloadRange: DownloadRange
  keywords: string[]
  security: SecurityFilter
  updatedWithin: UpdatedWithin
}

export const DEFAULT_FILTERS: StructuredFilters = {
  text: '',
  searchScope: 'name',
  downloadRange: 'any',
  keywords: [],
  security: 'all',
  updatedWithin: 'any',
}

// Pagination modes
export type PaginationMode = 'infinite' | 'paginated'

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 'all'] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

// Complete preferences state
export interface PackageListPreferences {
  viewMode: ViewMode
  columns: ColumnConfig[]
  paginationMode: PaginationMode
  pageSize: PageSize
}

export const DEFAULT_PREFERENCES: PackageListPreferences = {
  viewMode: 'cards',
  columns: DEFAULT_COLUMNS,
  paginationMode: 'infinite',
  pageSize: 25,
}

// Active filter chip representation
export interface FilterChip {
  id: string
  type: keyof StructuredFilters
  label: string
  value: string | string[]
}
