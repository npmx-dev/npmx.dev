import type { ComparisonFacet, FacetInfo } from '#shared/types'
import {
  ALL_FACETS,
  CATEGORY_ORDER,
  DEFAULT_FACETS,
  FACET_INFO,
  FACETS_BY_CATEGORY,
} from '#shared/types/comparison'
import { useRouteQuery } from '@vueuse/router'

/** Facet info enriched with i18n labels */
export interface FacetInfoWithLabels extends Omit<FacetInfo, 'id'> {
  id: ComparisonFacet
  label: string
  description: string
}

/**
 * Composable for managing comparison facet selection with URL sync.
 *
 * @param queryParam - The URL query parameter name to use (default: 'facets')
 */
export function useFacetSelection(queryParam = 'facets') {
  const { t } = useI18n()

  const facetLabels = computed(
    (): Record<ComparisonFacet, { label: string; description: string }> => ({
      downloads: {
        label: t(`compare.facets.items.downloads.label`),
        description: t(`compare.facets.items.downloads.description`),
      },
      totalLikes: {
        label: t(`compare.facets.items.totalLikes.label`),
        description: t(`compare.facets.items.totalLikes.description`),
      },
      packageSize: {
        label: t(`compare.facets.items.packageSize.label`),
        description: t(`compare.facets.items.packageSize.description`),
      },
      installSize: {
        label: t(`compare.facets.items.installSize.label`),
        description: t(`compare.facets.items.installSize.description`),
      },
      moduleFormat: {
        label: t(`compare.facets.items.moduleFormat.label`),
        description: t(`compare.facets.items.moduleFormat.description`),
      },
      types: {
        label: t(`compare.facets.items.types.label`),
        description: t(`compare.facets.items.types.description`),
      },
      engines: {
        label: t(`compare.facets.items.engines.label`),
        description: t(`compare.facets.items.engines.description`),
      },
      vulnerabilities: {
        label: t(`compare.facets.items.vulnerabilities.label`),
        description: t(`compare.facets.items.vulnerabilities.description`),
      },
      lastUpdated: {
        label: t(`compare.facets.items.lastUpdated.label`),
        description: t(`compare.facets.items.lastUpdated.description`),
      },
      license: {
        label: t(`compare.facets.items.license.label`),
        description: t(`compare.facets.items.license.description`),
      },
      dependencies: {
        label: t(`compare.facets.items.dependencies.label`),
        description: t(`compare.facets.items.dependencies.description`),
      },
      totalDependencies: {
        label: t(`compare.facets.items.totalDependencies.label`),
        description: t(`compare.facets.items.totalDependencies.description`),
      },
      deprecated: {
        label: t(`compare.facets.items.deprecated.label`),
        description: t(`compare.facets.items.deprecated.description`),
      },
    }),
  )

  // Helper to build facet info with i18n labels
  function buildFacetInfo(facet: ComparisonFacet): FacetInfoWithLabels {
    return {
      id: facet,
      ...FACET_INFO[facet],
      label: facetLabels.value[facet].label,
      description: facetLabels.value[facet].description,
    }
  }

  // Sync with URL query param (stable ref - doesn't change on other query changes)
  const facetsParam = useRouteQuery<string>(queryParam, '', { mode: 'replace' })

  // Parse facet IDs from URL or use defaults
  const selectedFacetIds = computed<ComparisonFacet[]>({
    get() {
      if (!facetsParam.value) {
        return DEFAULT_FACETS
      }

      // Parse comma-separated facets and filter valid, non-comingSoon ones
      const parsed = facetsParam.value
        .split(',')
        .map(f => f.trim())
        .filter(
          (f): f is ComparisonFacet =>
            ALL_FACETS.includes(f as ComparisonFacet) &&
            !FACET_INFO[f as ComparisonFacet].comingSoon,
        )

      return parsed.length > 0 ? parsed : DEFAULT_FACETS
    },
    set(facets) {
      if (facets.length === 0 || arraysEqual(facets, DEFAULT_FACETS)) {
        // Remove param if using defaults
        facetsParam.value = ''
      } else {
        facetsParam.value = facets.join(',')
      }
    },
  })

  // Selected facets with full info and i18n labels
  const selectedFacets = computed<FacetInfoWithLabels[]>(() =>
    selectedFacetIds.value.map(buildFacetInfo),
  )

  // Check if a facet is selected
  function isFacetSelected(facet: ComparisonFacet): boolean {
    return selectedFacetIds.value.includes(facet)
  }

  // Toggle a single facet
  function toggleFacet(facet: ComparisonFacet): void {
    const current = selectedFacetIds.value
    if (current.includes(facet)) {
      // Don't allow deselecting all facets
      if (current.length > 1) {
        selectedFacetIds.value = current.filter(f => f !== facet)
      }
    } else {
      selectedFacetIds.value = [...current, facet]
    }
  }

  // Get facets in a category (excluding coming soon)
  function getFacetsInCategory(category: string): ComparisonFacet[] {
    return ALL_FACETS.filter(f => {
      const info = FACET_INFO[f]
      return info.category === category && !info.comingSoon
    })
  }

  // Select all facets in a category
  function selectCategory(category: string): void {
    const categoryFacets = getFacetsInCategory(category)
    const current = selectedFacetIds.value
    const newFacets = [...new Set([...current, ...categoryFacets])]
    selectedFacetIds.value = newFacets
  }

  // Deselect all facets in a category
  function deselectCategory(category: string): void {
    const categoryFacets = getFacetsInCategory(category)
    const remaining = selectedFacetIds.value.filter(f => !categoryFacets.includes(f))
    // Don't allow deselecting all facets
    if (remaining.length > 0) {
      selectedFacetIds.value = remaining
    }
  }

  // Select all facets globally
  function selectAll(): void {
    selectedFacetIds.value = DEFAULT_FACETS
  }

  // Deselect all facets globally (keeps first facet to ensure at least one)
  function deselectAll(): void {
    selectedFacetIds.value = [DEFAULT_FACETS[0] as ComparisonFacet]
  }

  // Check if all facets are selected
  const isAllSelected = computed(() => selectedFacetIds.value.length === DEFAULT_FACETS.length)

  // Check if only one facet is selected (minimum)
  const isNoneSelected = computed(() => selectedFacetIds.value.length === 1)

  const facetCategories = {
    performance: t(`compare.facets.categories.performance`),
    health: t(`compare.facets.categories.health`),
    compatibility: t(`compare.facets.categories.compatibility`),
    security: t(`compare.facets.categories.security`),
  }

  // Get translated category name
  function getCategoryLabel(category: FacetInfo['category']): string {
    return facetCategories[category]
  }

  // All facets with their info and i18n labels, grouped by category
  const facetsByCategory = computed(() => {
    const result: Record<string, FacetInfoWithLabels[]> = {}
    for (const category of CATEGORY_ORDER) {
      result[category] = FACETS_BY_CATEGORY[category].map(buildFacetInfo)
    }
    return result
  })

  return {
    selectedFacets,
    isFacetSelected,
    toggleFacet,
    selectCategory,
    deselectCategory,
    selectAll,
    deselectAll,
    isAllSelected,
    isNoneSelected,
    allFacets: ALL_FACETS,
    // Facet info with i18n
    getCategoryLabel,
    facetsByCategory,
    categoryOrder: CATEGORY_ORDER,
  }
}

// Helper to compare arrays
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((val, i) => val === sortedB[i])
}
