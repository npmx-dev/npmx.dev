import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import type { ComparisonFacet } from '#shared/types/comparison'
import {
  DEFAULT_FACETS,
  FACET_INFO,
  FACETS_BY_CATEGORY,
  hasComingSoonFacets,
} from '#shared/types/comparison'
import type { FacetInfoWithLabels } from '~/composables/useFacetSelection'

// Mock useRouteQuery - needs to be outside of the helper to persist across calls
const mockRouteQuery = ref('')
vi.mock('@vueuse/router', () => ({
  useRouteQuery: () => mockRouteQuery,
}))

/**
 * Helper to test useFacetSelection by wrapping it in a component.
 * This is required because the composable uses useI18n which must be
 * called inside a Vue component's setup function.
 */
async function useFacetSelectionInComponent() {
  // Create refs to capture the composable's return values
  const capturedSelectedFacets = shallowRef<FacetInfoWithLabels[]>([])
  const capturedIsAllSelected = ref(false)
  const capturedIsNoneSelected = ref(false)
  let capturedIsFacetSelected: (facet: ComparisonFacet) => boolean
  let capturedToggleFacet: (facet: ComparisonFacet) => void
  let capturedSelectCategory: (category: string) => void
  let capturedDeselectCategory: (category: string) => void
  let capturedSelectAll: () => void
  let capturedDeselectAll: () => void
  let capturedAllFacets: ComparisonFacet[]

  const WrapperComponent = defineComponent({
    setup() {
      const {
        selectedFacets,
        isFacetSelected,
        toggleFacet,
        selectCategory,
        deselectCategory,
        selectAll,
        deselectAll,
        isAllSelected,
        isNoneSelected,
        allFacets,
      } = useFacetSelection()

      // Sync values to captured refs
      watchEffect(() => {
        capturedSelectedFacets.value = [...selectedFacets.value]
        capturedIsAllSelected.value = isAllSelected.value
        capturedIsNoneSelected.value = isNoneSelected.value
      })

      capturedIsFacetSelected = isFacetSelected
      capturedToggleFacet = toggleFacet
      capturedSelectCategory = selectCategory
      capturedDeselectCategory = deselectCategory
      capturedSelectAll = selectAll
      capturedDeselectAll = deselectAll
      capturedAllFacets = allFacets

      return () => h('div')
    },
  })

  await mountSuspended(WrapperComponent)

  return {
    selectedFacets: capturedSelectedFacets,
    isFacetSelected: (facet: ComparisonFacet) => capturedIsFacetSelected(facet),
    toggleFacet: (facet: ComparisonFacet) => capturedToggleFacet(facet),
    selectCategory: (category: string) => capturedSelectCategory(category),
    deselectCategory: (category: string) => capturedDeselectCategory(category),
    selectAll: () => capturedSelectAll(),
    deselectAll: () => capturedDeselectAll(),
    isAllSelected: capturedIsAllSelected,
    isNoneSelected: capturedIsNoneSelected,
    allFacets: capturedAllFacets!,
  }
}

describe('useFacetSelection', () => {
  beforeEach(() => {
    mockRouteQuery.value = ''
  })

  it('returns DEFAULT_FACETS when no query param', async () => {
    const { isFacetSelected } = await useFacetSelectionInComponent()

    // All default facets should be selected
    for (const facet of DEFAULT_FACETS) {
      expect(isFacetSelected(facet)).toBe(true)
    }
  })

  it('parses facets from query param', async () => {
    mockRouteQuery.value = 'downloads,types,license'

    const { isFacetSelected } = await useFacetSelectionInComponent()

    expect(isFacetSelected('downloads')).toBe(true)
    expect(isFacetSelected('types')).toBe(true)
    expect(isFacetSelected('license')).toBe(true)
    expect(isFacetSelected('packageSize')).toBe(false)
  })

  it('filters out invalid facets from query', async () => {
    mockRouteQuery.value = 'downloads,invalidFacet,types'

    const { isFacetSelected } = await useFacetSelectionInComponent()

    expect(isFacetSelected('downloads')).toBe(true)
    expect(isFacetSelected('types')).toBe(true)
  })

  it.runIf(hasComingSoonFacets)('filters out comingSoon facets from query', async () => {
    mockRouteQuery.value = 'downloads,totalDependencies,types'

    const { isFacetSelected } = await useFacetSelectionInComponent()

    expect(isFacetSelected('downloads')).toBe(true)
    expect(isFacetSelected('types')).toBe(true)
    expect(isFacetSelected('totalDependencies')).toBe(false)
  })

  it('falls back to DEFAULT_FACETS if all parsed facets are invalid', async () => {
    mockRouteQuery.value = 'invalidFacet1,invalidFacet2'

    const { isFacetSelected } = await useFacetSelectionInComponent()

    // All default facets should be selected when query is invalid
    for (const facet of DEFAULT_FACETS) {
      expect(isFacetSelected(facet)).toBe(true)
    }
  })

  describe('selectedFacets enriched data', () => {
    it('includes label and description for each facet', async () => {
      mockRouteQuery.value = 'downloads,types'

      const { selectedFacets } = await useFacetSelectionInComponent()

      for (const facet of selectedFacets.value) {
        expect(facet.id).toBeDefined()
        expect(facet.label).toBeDefined()
        expect(facet.description).toBeDefined()
        expect(facet.category).toBeDefined()
      }
    })

    it('includes category info for each facet', async () => {
      mockRouteQuery.value = 'downloads,packageSize'

      const { selectedFacets } = await useFacetSelectionInComponent()

      const downloadsFacet = selectedFacets.value.find(f => f.id === 'downloads')
      const packageSizeFacet = selectedFacets.value.find(f => f.id === 'packageSize')

      expect(downloadsFacet?.category).toBe('health')
      expect(packageSizeFacet?.category).toBe('performance')
    })
  })

  describe('isFacetSelected', () => {
    it('returns true for selected facets', async () => {
      mockRouteQuery.value = 'downloads,types'

      const { isFacetSelected } = await useFacetSelectionInComponent()

      expect(isFacetSelected('downloads')).toBe(true)
      expect(isFacetSelected('types')).toBe(true)
    })

    it('returns false for unselected facets', async () => {
      mockRouteQuery.value = 'downloads,types'

      const { isFacetSelected } = await useFacetSelectionInComponent()

      expect(isFacetSelected('license')).toBe(false)
      expect(isFacetSelected('engines')).toBe(false)
    })
  })

  describe('toggleFacet', () => {
    it('adds facet when not selected', async () => {
      mockRouteQuery.value = 'downloads'

      const { isFacetSelected, toggleFacet } = await useFacetSelectionInComponent()

      toggleFacet('types')

      expect(isFacetSelected('downloads')).toBe(true)
      expect(isFacetSelected('types')).toBe(true)
    })

    it('removes facet when selected', async () => {
      mockRouteQuery.value = 'downloads,types'

      const { isFacetSelected, toggleFacet } = await useFacetSelectionInComponent()

      toggleFacet('types')

      expect(isFacetSelected('downloads')).toBe(true)
      expect(isFacetSelected('types')).toBe(false)
    })

    it('does not remove last facet', async () => {
      mockRouteQuery.value = 'downloads'

      const { isFacetSelected, toggleFacet } = await useFacetSelectionInComponent()

      toggleFacet('downloads')

      // Should still be selected (can't remove the last one)
      expect(isFacetSelected('downloads')).toBe(true)
    })
  })

  describe('selectCategory', () => {
    it('selects all facets in a category', async () => {
      mockRouteQuery.value = 'downloads'

      const { isFacetSelected, selectCategory } = await useFacetSelectionInComponent()

      selectCategory('performance')

      const performanceFacets = FACETS_BY_CATEGORY.performance.filter(
        f => !FACET_INFO[f].comingSoon, // comingSoon facet
      )
      for (const facet of performanceFacets) {
        expect(isFacetSelected(facet)).toBe(true)
      }
    })

    it('preserves existing selections from other categories', async () => {
      mockRouteQuery.value = 'downloads,license'

      const { isFacetSelected, selectCategory } = await useFacetSelectionInComponent()

      selectCategory('compatibility')

      expect(isFacetSelected('downloads')).toBe(true)
      expect(isFacetSelected('license')).toBe(true)
    })
  })

  describe('deselectCategory', () => {
    it('deselects all facets in a category', async () => {
      mockRouteQuery.value = ''
      const { isFacetSelected, deselectCategory } = await useFacetSelectionInComponent()

      deselectCategory('performance')

      const nonComingSoonPerformanceFacets = FACETS_BY_CATEGORY.performance.filter(
        f => !FACET_INFO[f].comingSoon,
      )
      for (const facet of nonComingSoonPerformanceFacets) {
        expect(isFacetSelected(facet)).toBe(false)
      }
    })

    it('does not deselect if it would leave no facets', async () => {
      mockRouteQuery.value = 'packageSize,installSize'

      const { isFacetSelected, deselectCategory } = await useFacetSelectionInComponent()

      deselectCategory('performance')

      // Should still have at least one facet selected - since we can't
      // deselect all, the original selection should remain
      expect(isFacetSelected('packageSize') || isFacetSelected('installSize')).toBe(true)
    })
  })

  describe('selectAll', () => {
    it('selects all default facets', async () => {
      mockRouteQuery.value = 'downloads'

      const { isFacetSelected, selectAll } = await useFacetSelectionInComponent()

      selectAll()

      for (const facet of DEFAULT_FACETS) {
        expect(isFacetSelected(facet)).toBe(true)
      }
    })
  })

  describe('deselectAll', () => {
    it('keeps only the first default facet', async () => {
      mockRouteQuery.value = ''

      const { isFacetSelected, deselectAll } = await useFacetSelectionInComponent()

      deselectAll()

      // Only the first default facet should be selected
      expect(isFacetSelected(DEFAULT_FACETS[0]!)).toBe(true)
      // Second one should not be selected
      expect(isFacetSelected(DEFAULT_FACETS[1]!)).toBe(false)
    })
  })

  describe('isAllSelected', () => {
    it('returns true when all facets selected', async () => {
      mockRouteQuery.value = ''

      const { isAllSelected } = await useFacetSelectionInComponent()

      expect(isAllSelected.value).toBe(true)
    })

    it('returns false when not all facets selected', async () => {
      mockRouteQuery.value = 'downloads,types'

      const { isAllSelected } = await useFacetSelectionInComponent()

      expect(isAllSelected.value).toBe(false)
    })
  })

  describe('isNoneSelected', () => {
    it('returns true when only one facet selected', async () => {
      mockRouteQuery.value = 'downloads'

      const { isNoneSelected } = await useFacetSelectionInComponent()

      expect(isNoneSelected.value).toBe(true)
    })

    it('returns false when multiple facets selected', async () => {
      mockRouteQuery.value = 'downloads,types'

      const { isNoneSelected } = await useFacetSelectionInComponent()

      expect(isNoneSelected.value).toBe(false)
    })
  })

  describe('URL param behavior', () => {
    it('clears URL param when selecting all defaults', async () => {
      mockRouteQuery.value = 'downloads,types'

      const { selectAll } = await useFacetSelectionInComponent()

      selectAll()

      // Should clear to empty string when matching defaults
      expect(mockRouteQuery.value).toBe('')
    })

    it('sets URL param when selecting subset of facets via toggleFacet', async () => {
      mockRouteQuery.value = ''

      const { toggleFacet, deselectAll } = await useFacetSelectionInComponent()

      // Start with one facet, then add another
      deselectAll()
      toggleFacet('types')

      expect(mockRouteQuery.value).toContain('types')
    })
  })

  describe('allFacets export', () => {
    it('exports allFacets array', async () => {
      const { allFacets } = await useFacetSelectionInComponent()

      expect(Array.isArray(allFacets)).toBe(true)
      expect(allFacets.length).toBeGreaterThan(0)
    })
  })

  describe('whitespace handling', () => {
    it('trims whitespace from facet names in query', async () => {
      mockRouteQuery.value = ' downloads , types , license '

      const { isFacetSelected } = await useFacetSelectionInComponent()

      expect(isFacetSelected('downloads')).toBe(true)
      expect(isFacetSelected('types')).toBe(true)
      expect(isFacetSelected('license')).toBe(true)
    })
  })

  describe('duplicate handling', () => {
    it('handles duplicate facets in query by deduplication via Set', async () => {
      // When adding facets, the code uses Set for deduplication
      mockRouteQuery.value = 'downloads'

      const { isFacetSelected, selectCategory } = await useFacetSelectionInComponent()

      // downloads is in health category, selecting health should dedupe
      selectCategory('health')

      // downloads should be selected exactly once (verified by isFacetSelected working)
      expect(isFacetSelected('downloads')).toBe(true)
    })
  })

  describe('multiple category operations', () => {
    it('can select multiple categories', async () => {
      mockRouteQuery.value = 'downloads'

      const { isFacetSelected, selectCategory } = await useFacetSelectionInComponent()

      selectCategory('performance')
      selectCategory('security')

      // Should have facets from both categories plus original
      expect(isFacetSelected('packageSize')).toBe(true)
      expect(isFacetSelected('license')).toBe(true)
      expect(isFacetSelected('downloads')).toBe(true)
    })

    it('can deselect multiple categories', async () => {
      mockRouteQuery.value = ''

      const { isFacetSelected, deselectCategory } = await useFacetSelectionInComponent()

      deselectCategory('performance')
      deselectCategory('health')

      // Should not have performance or health facets
      expect(isFacetSelected('packageSize')).toBe(false)
      expect(isFacetSelected('downloads')).toBe(false)
    })
  })
})
