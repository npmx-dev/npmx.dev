import type { ComparisonFacet } from '#shared/types/comparison'
import { CATEGORY_ORDER, FACET_INFO, FACETS_BY_CATEGORY } from '#shared/types/comparison'
import FacetSelector from '~/components/compare/FacetSelector.vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'

// Mock useFacetSelection
const mockSelectedFacets = ref<string[]>(['downloads', 'types'])
const mockIsFacetSelected = vi.fn((facet: string) => mockSelectedFacets.value.includes(facet))
const mockToggleFacet = vi.fn()
const mockSelectCategory = vi.fn()
const mockDeselectCategory = vi.fn()
const mockSelectAll = vi.fn()
const mockDeselectAll = vi.fn()
const mockIsAllSelected = ref(false)
const mockIsNoneSelected = ref(false)

vi.mock('~/composables/useFacetSelection', () => ({
  useFacetSelection: () => ({
    selectedFacets: mockSelectedFacets,
    isFacetSelected: mockIsFacetSelected,
    toggleFacet: mockToggleFacet,
    selectCategory: mockSelectCategory,
    deselectCategory: mockDeselectCategory,
    selectAll: mockSelectAll,
    deselectAll: mockDeselectAll,
    isAllSelected: mockIsAllSelected,
    isNoneSelected: mockIsNoneSelected,
  }),
}))

// Mock useRouteQuery for composable
vi.mock('@vueuse/router', () => ({
  useRouteQuery: () => ref(''),
}))

describe('FacetSelector', () => {
  beforeEach(() => {
    mockSelectedFacets.value = ['downloads', 'types']
    mockIsFacetSelected.mockImplementation((facet: string) =>
      mockSelectedFacets.value.includes(facet),
    )
    mockToggleFacet.mockClear()
    mockSelectCategory.mockClear()
    mockDeselectCategory.mockClear()
    mockSelectAll.mockClear()
    mockDeselectAll.mockClear()
    mockIsAllSelected.value = false
    mockIsNoneSelected.value = false
  })

  describe('category rendering', () => {
    it('renders all categories', async () => {
      const component = await mountSuspended(FacetSelector)

      for (const category of CATEGORY_ORDER) {
        // Categories are rendered as uppercase text
        expect(component.text().toLowerCase()).toContain(category)
      }
    })

    it('renders category headers with all/none buttons', async () => {
      const component = await mountSuspended(FacetSelector)

      // Each category has all/none buttons
      const allButtons = component.findAll('button').filter(b => b.text() === 'all')
      const noneButtons = component.findAll('button').filter(b => b.text() === 'none')

      // 4 categories = 4 all buttons + 4 none buttons
      expect(allButtons.length).toBe(4)
      expect(noneButtons.length).toBe(4)
    })
  })

  describe('facet buttons', () => {
    it('renders all facets from FACET_INFO', async () => {
      const component = await mountSuspended(FacetSelector)

      for (const facet of Object.keys(FACET_INFO)) {
        const facetInfo = FACET_INFO[facet as keyof typeof FACET_INFO]
        expect(component.text()).toContain(facetInfo.label)
      }
    })

    it('shows checkmark icon for selected facets', async () => {
      mockSelectedFacets.value = ['downloads']
      mockIsFacetSelected.mockImplementation((f: string) => f === 'downloads')

      const component = await mountSuspended(FacetSelector)

      expect(component.find('.i-carbon\\:checkmark').exists()).toBe(true)
    })

    it('shows add icon for unselected facets', async () => {
      mockSelectedFacets.value = ['downloads']
      mockIsFacetSelected.mockImplementation((f: string) => f === 'downloads')

      const component = await mountSuspended(FacetSelector)

      expect(component.find('.i-carbon\\:add').exists()).toBe(true)
    })

    it('applies aria-pressed for selected state', async () => {
      mockSelectedFacets.value = ['downloads']
      mockIsFacetSelected.mockImplementation((f: string) => f === 'downloads')

      const component = await mountSuspended(FacetSelector)

      const buttons = component.findAll('button[aria-pressed]')
      const selectedButton = buttons.find(b => b.attributes('aria-pressed') === 'true')
      expect(selectedButton).toBeDefined()
    })

    it('calls toggleFacet when facet button is clicked', async () => {
      const component = await mountSuspended(FacetSelector)

      // Find a facet button (not all/none)
      const facetButton = component.findAll('button').find(b => b.text().includes('Downloads'))
      await facetButton?.trigger('click')

      expect(mockToggleFacet).toHaveBeenCalled()
    })
  })

  describe('comingSoon facets', () => {
    it('disables comingSoon facets', async () => {
      const component = await mountSuspended(FacetSelector)

      // totalDependencies is marked as comingSoon
      const buttons = component.findAll('button')
      const comingSoonButton = buttons.find(b => b.text().includes('# Total Deps'))

      expect(comingSoonButton?.attributes('disabled')).toBeDefined()
    })

    it('shows coming soon text for comingSoon facets', async () => {
      const component = await mountSuspended(FacetSelector)

      expect(component.text().toLowerCase()).toContain('coming soon')
    })

    it('does not show checkmark/add icon for comingSoon facets', async () => {
      const component = await mountSuspended(FacetSelector)

      // Find the comingSoon button
      const buttons = component.findAll('button')
      const comingSoonButton = buttons.find(b => b.text().includes('# Total Deps'))

      // Should not have checkmark or add icon
      expect(comingSoonButton?.find('.i-carbon\\:checkmark').exists()).toBe(false)
      expect(comingSoonButton?.find('.i-carbon\\:add').exists()).toBe(false)
    })

    it('does not call toggleFacet when comingSoon facet is clicked', async () => {
      const component = await mountSuspended(FacetSelector)

      const buttons = component.findAll('button')
      const comingSoonButton = buttons.find(b => b.text().includes('# Total Deps'))
      await comingSoonButton?.trigger('click')

      // toggleFacet should not have been called with totalDependencies
      expect(mockToggleFacet).not.toHaveBeenCalledWith('totalDependencies')
    })
  })

  describe('category all/none buttons', () => {
    it('calls selectCategory when all button is clicked', async () => {
      const component = await mountSuspended(FacetSelector)

      // Find the first 'all' button (for performance category)
      const allButton = component.findAll('button').find(b => b.text() === 'all')
      await allButton!.trigger('click')

      expect(mockSelectCategory).toHaveBeenCalledWith('performance')
    })

    it('calls deselectCategory when none button is clicked', async () => {
      // Select a performance facet so 'none' button is enabled
      mockSelectedFacets.value = ['packageSize']
      mockIsFacetSelected.mockImplementation((f: string) => f === 'packageSize')

      const component = await mountSuspended(FacetSelector)

      // Find the first 'none' button (for performance category)
      const noneButton = component.findAll('button').find(b => b.text() === 'none')
      await noneButton!.trigger('click')

      expect(mockDeselectCategory).toHaveBeenCalledWith('performance')
    })

    it('disables all button when all facets in category are selected', async () => {
      // Select all performance facets
      const performanceFacets = FACETS_BY_CATEGORY.performance.filter(
        f => !FACET_INFO[f].comingSoon,
      )
      mockSelectedFacets.value = performanceFacets
      mockIsFacetSelected.mockImplementation((f: string) =>
        performanceFacets.includes(f as ComparisonFacet),
      )

      const component = await mountSuspended(FacetSelector)

      const allButton = component.findAll('button').find(b => b.text() === 'all')
      // First all button (performance) should be disabled
      expect(allButton!.attributes('disabled')).toBeDefined()
    })

    it('disables none button when no facets in category are selected', async () => {
      // Deselect all performance facets
      mockSelectedFacets.value = ['downloads'] // only health facet selected
      mockIsFacetSelected.mockImplementation((f: string) => f === 'downloads')

      const component = await mountSuspended(FacetSelector)

      const noneButton = component.findAll('button').find(b => b.text() === 'none')
      // First none button (performance) should be disabled
      expect(noneButton!.attributes('disabled')).toBeDefined()
    })
  })

  describe('styling', () => {
    it('applies selected styling to selected facets', async () => {
      mockSelectedFacets.value = ['downloads']
      mockIsFacetSelected.mockImplementation((f: string) => f === 'downloads')

      const component = await mountSuspended(FacetSelector)

      // Selected facets have bg-bg-muted class
      expect(component.find('.bg-bg-muted').exists()).toBe(true)
    })

    it('applies cursor-not-allowed to comingSoon facets', async () => {
      const component = await mountSuspended(FacetSelector)

      expect(component.find('.cursor-not-allowed').exists()).toBe(true)
    })
  })
})
