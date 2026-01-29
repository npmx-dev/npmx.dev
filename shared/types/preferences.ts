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
  label: string
  visible: boolean
  sortable: boolean
  width?: string
  /** Whether the column is disabled (not yet available) */
  disabled?: boolean
  /** Reason for being disabled, shown in UI */
  disabledReason?: string
}

// Default column configuration
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', visible: true, sortable: true, width: 'minmax(200px, 1fr)' },
  { id: 'version', label: 'Version', visible: true, sortable: false, width: '100px' },
  {
    id: 'description',
    label: 'Description',
    visible: true,
    sortable: false,
    width: 'minmax(200px, 2fr)',
  },
  { id: 'downloads', label: 'Downloads/wk', visible: true, sortable: true, width: '120px' },
  { id: 'updated', label: 'Updated', visible: true, sortable: true, width: '120px' },
  { id: 'maintainers', label: 'Maintainers', visible: false, sortable: false, width: '150px' },
  { id: 'keywords', label: 'Keywords', visible: false, sortable: false, width: '200px' },
  {
    id: 'qualityScore',
    label: 'Quality score',
    visible: false,
    sortable: true,
    width: '100px',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    id: 'popularityScore',
    label: 'Popularity score',
    visible: false,
    sortable: true,
    width: '100px',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    id: 'maintenanceScore',
    label: 'Maintenance score',
    visible: false,
    sortable: true,
    width: '100px',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    id: 'combinedScore',
    label: 'Combined score',
    visible: false,
    sortable: true,
    width: '100px',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    id: 'security',
    label: 'Security',
    visible: false,
    sortable: false,
    width: '80px',
    disabled: true,
    disabledReason: 'Coming soon',
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
  label: string
  /** Default direction for this sort key */
  defaultDirection: SortDirection
  /** Whether the sort option is disabled (not yet available) */
  disabled?: boolean
  /** Reason for being disabled, shown in UI */
  disabledReason?: string
  /** Only show this sort option in search context */
  searchOnly?: boolean
}

export const SORT_KEYS: SortKeyConfig[] = [
  { key: 'relevance', label: 'Relevance', defaultDirection: 'desc', searchOnly: true },
  { key: 'downloads-week', label: 'Downloads/wk', defaultDirection: 'desc' },
  {
    key: 'downloads-day',
    label: 'Downloads/day',
    defaultDirection: 'desc',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    key: 'downloads-month',
    label: 'Downloads/mo',
    defaultDirection: 'desc',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    key: 'downloads-year',
    label: 'Downloads/yr',
    defaultDirection: 'desc',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  { key: 'updated', label: 'Updated', defaultDirection: 'desc' },
  { key: 'name', label: 'Name', defaultDirection: 'asc' },
  {
    key: 'quality',
    label: 'Quality',
    defaultDirection: 'desc',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    key: 'popularity',
    label: 'Popularity',
    defaultDirection: 'desc',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    defaultDirection: 'desc',
    disabled: true,
    disabledReason: 'Coming soon',
  },
  {
    key: 'score',
    label: 'Score',
    defaultDirection: 'desc',
    disabled: true,
    disabledReason: 'Coming soon',
  },
]

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
export function parseSortOption(option: SortOption): { key: SortKey; direction: SortDirection } {
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
  label: string
  min?: number
  max?: number
}

export const DOWNLOAD_RANGES: DownloadRangeConfig[] = [
  { value: 'any', label: 'Any' },
  { value: 'lt100', label: '< 100', max: 100 },
  { value: '100-1k', label: '100 - 1K', min: 100, max: 1000 },
  { value: '1k-10k', label: '1K - 10K', min: 1000, max: 10000 },
  { value: '10k-100k', label: '10K - 100K', min: 10000, max: 100000 },
  { value: 'gt100k', label: '> 100K', min: 100000 },
]

// Updated within presets
export type UpdatedWithin = 'any' | 'week' | 'month' | 'quarter' | 'year'

export interface UpdatedWithinConfig {
  value: UpdatedWithin
  label: string
  days?: number
}

export const UPDATED_WITHIN_OPTIONS: UpdatedWithinConfig[] = [
  { value: 'any', label: 'Any time' },
  { value: 'week', label: 'Past week', days: 7 },
  { value: 'month', label: 'Past month', days: 30 },
  { value: 'quarter', label: 'Past 3 months', days: 90 },
  { value: 'year', label: 'Past year', days: 365 },
]

// Security filter options
export type SecurityFilter = 'all' | 'secure' | 'warnings'

export interface SecurityFilterConfig {
  value: SecurityFilter
  label: string
}

export const SECURITY_FILTER_OPTIONS: SecurityFilterConfig[] = [
  { value: 'all', label: 'All packages' },
  { value: 'secure', label: 'Secure only' },
  { value: 'warnings', label: 'Insecure only' },
]

// Search scope options
export type SearchScope = 'name' | 'description' | 'keywords' | 'all'

export interface SearchScopeConfig {
  value: SearchScope
  label: string
  description: string
}

export const SEARCH_SCOPE_OPTIONS: SearchScopeConfig[] = [
  { value: 'name', label: 'Name', description: 'Search package names only' },
  { value: 'description', label: 'Description', description: 'Search descriptions only' },
  { value: 'keywords', label: 'Keywords', description: 'Search keywords only' },
  { value: 'all', label: 'All', description: 'Search name, description, and keywords' },
]

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
