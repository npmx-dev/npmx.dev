import type { ComparisonFacet } from '#shared/types'
import { ALL_FACETS, DEFAULT_FACETS, FACET_INFO } from '#shared/types/comparison'
import { useRouteQuery } from '@vueuse/router'

/**
 * Composable for managing comparison facet selection with URL sync.
 *
 * @param queryParam - The URL query parameter name to use (default: 'facets')
 */
export function useFacetSelection(queryParam = 'facets') {
  // Sync with URL query param (stable ref - doesn't change on other query changes)
  const facetsParam = useRouteQuery<string>(queryParam, '', { mode: 'replace' })

  // Parse facets from URL or use defaults
  const selectedFacets = computed<ComparisonFacet[]>({
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

  // Check if a facet is selected
  function isFacetSelected(facet: ComparisonFacet): boolean {
    return selectedFacets.value.includes(facet)
  }

  // Toggle a single facet
  function toggleFacet(facet: ComparisonFacet): void {
    const current = selectedFacets.value
    if (current.includes(facet)) {
      // Don't allow deselecting all facets
      if (current.length > 1) {
        selectedFacets.value = current.filter(f => f !== facet)
      }
    } else {
      selectedFacets.value = [...current, facet]
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
    const current = selectedFacets.value
    const newFacets = [...new Set([...current, ...categoryFacets])]
    selectedFacets.value = newFacets
  }

  // Deselect all facets in a category
  function deselectCategory(category: string): void {
    const categoryFacets = getFacetsInCategory(category)
    const remaining = selectedFacets.value.filter(f => !categoryFacets.includes(f))
    // Don't allow deselecting all facets
    if (remaining.length > 0) {
      selectedFacets.value = remaining
    }
  }

  // Select all facets globally
  function selectAll(): void {
    selectedFacets.value = DEFAULT_FACETS
  }

  // Deselect all facets globally (keeps first facet to ensure at least one)
  function deselectAll(): void {
    selectedFacets.value = [DEFAULT_FACETS[0] as ComparisonFacet]
  }

  // Check if all facets are selected
  const isAllSelected = computed(() => selectedFacets.value.length === DEFAULT_FACETS.length)

  // Check if only one facet is selected (minimum)
  const isNoneSelected = computed(() => selectedFacets.value.length === 1)

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
  }
}

// Helper to compare arrays
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((val, i) => val === sortedB[i])
}
