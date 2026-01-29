/**
 * Filter pipeline and sorting logic for package lists
 */
import type { NpmSearchResult } from '#shared/types/npm-registry'
import type {
  DownloadRange,
  FilterChip,
  SearchScope,
  SecurityFilter,
  SortOption,
  StructuredFilters,
  UpdatedWithin,
} from '#shared/types/preferences'
import {
  DEFAULT_FILTERS,
  DOWNLOAD_RANGES,
  parseSortOption,
  SECURITY_FILTER_OPTIONS,
  UPDATED_WITHIN_OPTIONS,
} from '#shared/types/preferences'

/**
 * Parsed search operators from text input
 */
export interface ParsedSearchOperators {
  name?: string[]
  description?: string[]
  keywords?: string[]
  text?: string // Remaining text without operators
}

/**
 * Parse search operators from text input.
 * Supports: name:, desc:/description:, kw:/keyword:
 * Multiple values can be comma-separated: kw:foo,bar
 * Remaining text is treated as a general search term.
 *
 * Example: "name:react kw:typescript,hooks some text"
 * Returns: { name: ['react'], keywords: ['typescript', 'hooks'], text: 'some text' }
 */
export function parseSearchOperators(input: string): ParsedSearchOperators {
  const result: ParsedSearchOperators = {}

  // Regex to match operators: name:value, desc:value, description:value, kw:value, keyword:value
  // Value continues until whitespace or next operator
  const operatorRegex = /\b(name|desc|description|kw|keyword):([^\s]+)/gi

  let remaining = input
  let match

  while ((match = operatorRegex.exec(input)) !== null) {
    const [fullMatch, operator, value] = match
    if (!operator || !value) continue

    const values = value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)

    const normalizedOp = operator.toLowerCase()
    if (normalizedOp === 'name') {
      result.name = [...(result.name ?? []), ...values]
    } else if (normalizedOp === 'desc' || normalizedOp === 'description') {
      result.description = [...(result.description ?? []), ...values]
    } else if (normalizedOp === 'kw' || normalizedOp === 'keyword') {
      result.keywords = [...(result.keywords ?? []), ...values]
    }

    // Remove matched operator from remaining text
    remaining = remaining.replace(fullMatch, '')
  }

  // Clean up remaining text
  const cleanedText = remaining.trim().replace(/\s+/g, ' ')
  if (cleanedText) {
    result.text = cleanedText
  }

  return result
}

/**
 * Check if parsed operators has any content
 */
export function hasSearchOperators(parsed: ParsedSearchOperators): boolean {
  return !!(parsed.name?.length || parsed.description?.length || parsed.keywords?.length)
}

interface UseStructuredFiltersOptions {
  packages: Ref<NpmSearchResult[]>
  initialFilters?: Partial<StructuredFilters>
  initialSort?: SortOption
}

// Pure filter predicates (no closure dependencies)
function matchesKeywords(pkg: NpmSearchResult, keywords: string[]): boolean {
  if (keywords.length === 0) return true
  const pkgKeywords = new Set((pkg.package.keywords ?? []).map(k => k.toLowerCase()))
  // AND logic: package must have ALL selected keywords (case-insensitive)
  return keywords.every(k => pkgKeywords.has(k.toLowerCase()))
}

function matchesSecurity(pkg: NpmSearchResult, security: SecurityFilter): boolean {
  if (security === 'all') return true
  const hasWarnings = (pkg.flags?.insecure ?? 0) > 0
  if (security === 'secure') return !hasWarnings
  if (security === 'warnings') return hasWarnings
  return true
}

/**
 * Composable for structured filtering and sorting of package lists
 *
 * @public
 */
export function useStructuredFilters(options: UseStructuredFiltersOptions) {
  const { packages, initialFilters, initialSort } = options

  // Filter state
  const filters = ref<StructuredFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  })

  // Sort state
  const sortOption = ref<SortOption>(initialSort ?? 'updated-desc')

  // Available keywords extracted from all packages
  const availableKeywords = computed(() => {
    const keywordCounts = new Map<string, number>()
    for (const pkg of packages.value) {
      const keywords = pkg.package.keywords ?? []
      for (const keyword of keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1)
      }
    }
    // Sort by count descending
    return Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([keyword]) => keyword)
  })

  // Filter predicates
  function matchesTextFilter(pkg: NpmSearchResult, text: string, scope: SearchScope): boolean {
    if (!text) return true

    const pkgName = pkg.package.name.toLowerCase()
    const pkgDescription = (pkg.package.description ?? '').toLowerCase()
    const pkgKeywords = (pkg.package.keywords ?? []).map(k => k.toLowerCase())

    // When scope is 'all', parse and handle operators
    if (scope === 'all') {
      const parsed = parseSearchOperators(text)

      // If operators are present, use structured matching
      if (hasSearchOperators(parsed)) {
        // All specified operators must match (AND logic between operator types)
        // Within each operator, any value can match (OR logic within operator)

        if (parsed.name?.length) {
          const nameMatches = parsed.name.some(n => pkgName.includes(n.toLowerCase()))
          if (!nameMatches) return false
        }

        if (parsed.description?.length) {
          const descMatches = parsed.description.some(d => pkgDescription.includes(d.toLowerCase()))
          if (!descMatches) return false
        }

        if (parsed.keywords?.length) {
          const kwMatches = parsed.keywords.some(kw =>
            pkgKeywords.some(pk => pk.includes(kw.toLowerCase())),
          )
          if (!kwMatches) return false
        }

        // If there's remaining text, it must match somewhere
        if (parsed.text) {
          const textLower = parsed.text.toLowerCase()
          const textMatches =
            pkgName.includes(textLower) ||
            pkgDescription.includes(textLower) ||
            pkgKeywords.some(k => k.includes(textLower))
          if (!textMatches) return false
        }

        return true
      }

      // No operators - fall through to standard 'all' search
      const lower = text.toLowerCase()
      return (
        pkgName.includes(lower) ||
        pkgDescription.includes(lower) ||
        pkgKeywords.some(k => k.includes(lower))
      )
    }

    // Non-'all' scopes - simple matching
    const lower = text.toLowerCase()
    switch (scope) {
      case 'name':
        return pkgName.includes(lower)
      case 'description':
        return pkgDescription.includes(lower)
      case 'keywords':
        return pkgKeywords.some(k => k.includes(lower))
      default:
        return pkgName.includes(lower)
    }
  }

  function matchesDownloadRange(pkg: NpmSearchResult, range: DownloadRange): boolean {
    if (range === 'any') return true
    const downloads = pkg.downloads?.weekly ?? 0
    const config = DOWNLOAD_RANGES.find(r => r.value === range)
    if (!config) return true
    if (config.min !== undefined && downloads < config.min) return false
    if (config.max !== undefined && downloads >= config.max) return false
    return true
  }

  function matchesUpdatedWithin(pkg: NpmSearchResult, within: UpdatedWithin): boolean {
    if (within === 'any') return true
    const config = UPDATED_WITHIN_OPTIONS.find(o => o.value === within)
    if (!config?.days) return true

    const updatedDate = new Date(pkg.updated ?? pkg.package.date)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - config.days)
    return updatedDate >= cutoff
  }

  // Apply all filters
  const filteredPackages = computed(() => {
    return packages.value.filter(pkg => {
      if (!matchesTextFilter(pkg, filters.value.text, filters.value.searchScope)) return false
      if (!matchesDownloadRange(pkg, filters.value.downloadRange)) return false
      if (!matchesKeywords(pkg, filters.value.keywords)) return false
      if (!matchesSecurity(pkg, filters.value.security)) return false
      if (!matchesUpdatedWithin(pkg, filters.value.updatedWithin)) return false
      return true
    })
  })

  // Sort comparators
  function comparePackages(a: NpmSearchResult, b: NpmSearchResult, option: SortOption): number {
    const { key, direction } = parseSortOption(option)
    const multiplier = direction === 'asc' ? 1 : -1

    let diff: number
    switch (key) {
      case 'downloads-week':
        diff = (a.downloads?.weekly ?? 0) - (b.downloads?.weekly ?? 0)
        break
      case 'downloads-day':
      case 'downloads-month':
      case 'downloads-year':
        // Not yet implemented - fall back to weekly
        diff = (a.downloads?.weekly ?? 0) - (b.downloads?.weekly ?? 0)
        break
      case 'updated':
        diff =
          new Date(a.updated ?? a.package.date).getTime() -
          new Date(b.updated ?? b.package.date).getTime()
        break
      case 'name':
        diff = a.package.name.localeCompare(b.package.name)
        break
      case 'quality':
        diff = (a.score?.detail?.quality ?? 0) - (b.score?.detail?.quality ?? 0)
        break
      case 'popularity':
        diff = (a.score?.detail?.popularity ?? 0) - (b.score?.detail?.popularity ?? 0)
        break
      case 'maintenance':
        diff = (a.score?.detail?.maintenance ?? 0) - (b.score?.detail?.maintenance ?? 0)
        break
      case 'score':
        diff = (a.score?.final ?? 0) - (b.score?.final ?? 0)
        break
      case 'relevance':
        // Relevance preserves server order (already sorted by search relevance)
        diff = 0
        break
      default:
        diff = 0
    }

    return diff * multiplier
  }

  // Apply sorting to filtered results
  const sortedPackages = computed(() => {
    return [...filteredPackages.value].sort((a, b) => comparePackages(a, b, sortOption.value))
  })

  // Active filter chips for display
  const activeFilters = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = []

    if (filters.value.text) {
      chips.push({
        id: 'text',
        type: 'text',
        label: 'Search',
        value: filters.value.text,
      })
    }

    if (filters.value.downloadRange !== 'any') {
      const config = DOWNLOAD_RANGES.find(r => r.value === filters.value.downloadRange)
      chips.push({
        id: 'downloadRange',
        type: 'downloadRange',
        label: 'Downloads',
        value: config?.label ?? filters.value.downloadRange,
      })
    }

    for (const keyword of filters.value.keywords) {
      chips.push({
        id: `keyword-${keyword}`,
        type: 'keywords',
        label: 'Keyword',
        value: keyword,
      })
    }

    if (filters.value.security !== 'all') {
      const config = SECURITY_FILTER_OPTIONS.find(o => o.value === filters.value.security)
      chips.push({
        id: 'security',
        type: 'security',
        label: 'Security',
        value: config?.label ?? filters.value.security,
      })
    }

    if (filters.value.updatedWithin !== 'any') {
      const config = UPDATED_WITHIN_OPTIONS.find(o => o.value === filters.value.updatedWithin)
      chips.push({
        id: 'updatedWithin',
        type: 'updatedWithin',
        label: 'Updated',
        value: config?.label ?? filters.value.updatedWithin,
      })
    }

    return chips
  })

  // Check if any filters are active
  const hasActiveFilters = computed(() => activeFilters.value.length > 0)

  // Filter update helpers
  function setTextFilter(text: string) {
    filters.value.text = text
  }

  function setSearchScope(scope: SearchScope) {
    filters.value.searchScope = scope
  }

  function setDownloadRange(range: DownloadRange) {
    filters.value.downloadRange = range
  }

  function addKeyword(keyword: string) {
    if (!filters.value.keywords.includes(keyword)) {
      filters.value.keywords = [...filters.value.keywords, keyword]
    }
  }

  function removeKeyword(keyword: string) {
    filters.value.keywords = filters.value.keywords.filter(k => k !== keyword)
  }

  function toggleKeyword(keyword: string) {
    if (filters.value.keywords.includes(keyword)) {
      removeKeyword(keyword)
    } else {
      addKeyword(keyword)
    }
  }

  function setSecurity(security: SecurityFilter) {
    filters.value.security = security
  }

  function setUpdatedWithin(within: UpdatedWithin) {
    filters.value.updatedWithin = within
  }

  function clearFilter(chip: FilterChip) {
    switch (chip.type) {
      case 'text':
        filters.value.text = ''
        break
      case 'downloadRange':
        filters.value.downloadRange = 'any'
        break
      case 'keywords':
        removeKeyword(chip.value as string)
        break
      case 'security':
        filters.value.security = 'all'
        break
      case 'updatedWithin':
        filters.value.updatedWithin = 'any'
        break
    }
  }

  function clearAllFilters() {
    filters.value = { ...DEFAULT_FILTERS }
  }

  function setSort(option: SortOption) {
    sortOption.value = option
  }

  return {
    // State
    filters,
    sortOption,

    // Derived
    filteredPackages,
    sortedPackages,
    availableKeywords,
    activeFilters,
    hasActiveFilters,

    // Filter setters
    setTextFilter,
    setSearchScope,
    setDownloadRange,
    addKeyword,
    removeKeyword,
    toggleKeyword,
    setSecurity,
    setUpdatedWithin,
    clearFilter,
    clearAllFilters,

    // Sort setter
    setSort,
  }
}
