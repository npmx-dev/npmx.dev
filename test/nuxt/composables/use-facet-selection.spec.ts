import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { DEFAULT_FACETS, FACETS_BY_CATEGORY } from '../../../shared/types/comparison'

// Mock useRouteQuery
const mockRouteQuery = ref('')
vi.mock('@vueuse/router', () => ({
  useRouteQuery: () => mockRouteQuery,
}))

describe('useFacetSelection', () => {
  beforeEach(() => {
    mockRouteQuery.value = ''
  })

  it('returns DEFAULT_FACETS when no query param', () => {
    const { selectedFacets } = useFacetSelection()

    expect(selectedFacets.value).toEqual(DEFAULT_FACETS)
  })

  it('parses facets from query param', () => {
    mockRouteQuery.value = 'downloads,types,license'

    const { selectedFacets } = useFacetSelection()

    expect(selectedFacets.value).toContain('downloads')
    expect(selectedFacets.value).toContain('types')
    expect(selectedFacets.value).toContain('license')
  })

  it('filters out invalid facets from query', () => {
    mockRouteQuery.value = 'downloads,invalidFacet,types'

    const { selectedFacets } = useFacetSelection()

    expect(selectedFacets.value).toContain('downloads')
    expect(selectedFacets.value).toContain('types')
    expect(selectedFacets.value).not.toContain('invalidFacet')
  })

  it('filters out comingSoon facets from query', () => {
    mockRouteQuery.value = 'downloads,totalDependencies,types'

    const { selectedFacets } = useFacetSelection()

    expect(selectedFacets.value).toContain('downloads')
    expect(selectedFacets.value).toContain('types')
    expect(selectedFacets.value).not.toContain('totalDependencies')
  })

  it('falls back to DEFAULT_FACETS if all parsed facets are invalid', () => {
    mockRouteQuery.value = 'invalidFacet1,invalidFacet2'

    const { selectedFacets } = useFacetSelection()

    expect(selectedFacets.value).toEqual(DEFAULT_FACETS)
  })

  describe('isFacetSelected', () => {
    it('returns true for selected facets', () => {
      mockRouteQuery.value = 'downloads,types'

      const { isFacetSelected } = useFacetSelection()

      expect(isFacetSelected('downloads')).toBe(true)
      expect(isFacetSelected('types')).toBe(true)
    })

    it('returns false for unselected facets', () => {
      mockRouteQuery.value = 'downloads,types'

      const { isFacetSelected } = useFacetSelection()

      expect(isFacetSelected('license')).toBe(false)
      expect(isFacetSelected('engines')).toBe(false)
    })
  })

  describe('toggleFacet', () => {
    it('adds facet when not selected', () => {
      mockRouteQuery.value = 'downloads'

      const { selectedFacets, toggleFacet } = useFacetSelection()

      toggleFacet('types')

      expect(selectedFacets.value).toContain('downloads')
      expect(selectedFacets.value).toContain('types')
    })

    it('removes facet when selected', () => {
      mockRouteQuery.value = 'downloads,types'

      const { selectedFacets, toggleFacet } = useFacetSelection()

      toggleFacet('types')

      expect(selectedFacets.value).toContain('downloads')
      expect(selectedFacets.value).not.toContain('types')
    })

    it('does not remove last facet', () => {
      mockRouteQuery.value = 'downloads'

      const { selectedFacets, toggleFacet } = useFacetSelection()

      toggleFacet('downloads')

      expect(selectedFacets.value).toContain('downloads')
      expect(selectedFacets.value.length).toBe(1)
    })
  })

  describe('selectCategory', () => {
    it('selects all facets in a category', () => {
      mockRouteQuery.value = 'downloads'

      const { selectedFacets, selectCategory } = useFacetSelection()

      selectCategory('performance')

      const performanceFacets = FACETS_BY_CATEGORY.performance.filter(
        f => f !== 'totalDependencies', // comingSoon facet
      )
      for (const facet of performanceFacets) {
        expect(selectedFacets.value).toContain(facet)
      }
    })

    it('preserves existing selections from other categories', () => {
      mockRouteQuery.value = 'downloads,license'

      const { selectedFacets, selectCategory } = useFacetSelection()

      selectCategory('compatibility')

      expect(selectedFacets.value).toContain('downloads')
      expect(selectedFacets.value).toContain('license')
    })
  })

  describe('deselectCategory', () => {
    it('deselects all facets in a category', () => {
      mockRouteQuery.value = ''
      const { selectedFacets, deselectCategory } = useFacetSelection()

      deselectCategory('performance')

      const nonComingSoonPerformanceFacets = FACETS_BY_CATEGORY.performance.filter(
        f => f !== 'totalDependencies',
      )
      for (const facet of nonComingSoonPerformanceFacets) {
        expect(selectedFacets.value).not.toContain(facet)
      }
    })

    it('does not deselect if it would leave no facets', () => {
      mockRouteQuery.value = 'packageSize,installSize'

      const { selectedFacets, deselectCategory } = useFacetSelection()

      deselectCategory('performance')

      // Should still have at least one facet
      expect(selectedFacets.value.length).toBeGreaterThan(0)
    })
  })

  describe('selectAll', () => {
    it('selects all default facets', () => {
      mockRouteQuery.value = 'downloads'

      const { selectedFacets, selectAll } = useFacetSelection()

      selectAll()

      expect(selectedFacets.value).toEqual(DEFAULT_FACETS)
    })
  })

  describe('deselectAll', () => {
    it('keeps only the first default facet', () => {
      mockRouteQuery.value = ''

      const { selectedFacets, deselectAll } = useFacetSelection()

      deselectAll()

      expect(selectedFacets.value).toHaveLength(1)
      expect(selectedFacets.value[0]).toBe(DEFAULT_FACETS[0])
    })
  })

  describe('isAllSelected', () => {
    it('returns true when all facets selected', () => {
      mockRouteQuery.value = ''

      const { isAllSelected } = useFacetSelection()

      expect(isAllSelected.value).toBe(true)
    })

    it('returns false when not all facets selected', () => {
      mockRouteQuery.value = 'downloads,types'

      const { isAllSelected } = useFacetSelection()

      expect(isAllSelected.value).toBe(false)
    })
  })

  describe('isNoneSelected', () => {
    it('returns true when only one facet selected', () => {
      mockRouteQuery.value = 'downloads'

      const { isNoneSelected } = useFacetSelection()

      expect(isNoneSelected.value).toBe(true)
    })

    it('returns false when multiple facets selected', () => {
      mockRouteQuery.value = 'downloads,types'

      const { isNoneSelected } = useFacetSelection()

      expect(isNoneSelected.value).toBe(false)
    })
  })
})
