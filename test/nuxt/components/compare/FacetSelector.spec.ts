import type { ComparisonFacet } from '#shared/types/comparison'
import {
  CATEGORY_ORDER,
  FACET_INFO,
  FACETS_BY_CATEGORY,
  comingSoonFacets,
  hasComingSoonFacets,
} from '#shared/types/comparison'
import FacetSelector from '~/components/Compare/FacetSelector.vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'

// Create facet label/description lookup
const facetLabels: Record<ComparisonFacet, { label: string; description: string }> = {
  downloads: { label: 'Downloads/wk', description: 'Weekly download count' },
  packageSize: { label: 'Package Size', description: 'Size of the package itself (unpacked)' },
  installSize: {
    label: 'Install Size',
    description: 'Total install size including all dependencies',
  },
  moduleFormat: { label: 'Module Format', description: 'ESM/CJS support' },
  types: { label: 'Types', description: 'TypeScript type definitions' },
  engines: { label: 'Engines', description: 'Node.js version requirements' },
  vulnerabilities: { label: 'Vulnerabilities', description: 'Known security vulnerabilities' },
  lastUpdated: { label: 'Published', description: 'When this version was published' },
  license: { label: 'License', description: 'Package license' },
  dependencies: { label: 'Direct Deps', description: 'Number of direct dependencies' },
  totalDependencies: {
    label: 'Total deps',
    description: 'Total number of dependencies including transitive',
  },
  deprecated: { label: 'Deprecated?', description: 'Whether the package is deprecated' },
  totalLikes: { label: 'Likes', description: 'Number of likes' },
}

const categoryLabels: Record<string, string> = {
  performance: 'Performance',
  health: 'Health',
  compatibility: 'Compatibility',
  security: 'Security & Compliance',
}

const comingSoonFacetId = comingSoonFacets[0]
const comingSoonFacetLabel = hasComingSoonFacets
  ? (facetLabels[comingSoonFacetId!]?.label ?? comingSoonFacetId)
  : ''

// Helper to build facet info with labels
function buildFacetInfo(facet: ComparisonFacet) {
  return {
    id: facet,
    ...FACET_INFO[facet],
    label: facetLabels[facet]?.label ?? facet,
    description: facetLabels[facet]?.description ?? '',
  }
}

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
    selectedFacets: computed(() =>
      mockSelectedFacets.value.map(id => buildFacetInfo(id as ComparisonFacet)),
    ),
    isFacetSelected: mockIsFacetSelected,
    toggleFacet: mockToggleFacet,
    selectCategory: mockSelectCategory,
    deselectCategory: mockDeselectCategory,
    selectAll: mockSelectAll,
    deselectAll: mockDeselectAll,
    isAllSelected: mockIsAllSelected,
    isNoneSelected: mockIsNoneSelected,
    // Facet info with i18n
    getCategoryLabel: (category: string) => categoryLabels[category] ?? category,
    facetsByCategory: computed(() => {
      const result: Record<string, ReturnType<typeof buildFacetInfo>[]> = {}
      for (const category of CATEGORY_ORDER) {
        result[category] = FACETS_BY_CATEGORY[category].map(facet => buildFacetInfo(facet))
      }
      return result
    }),
    categoryOrder: CATEGORY_ORDER,
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

      for (const facet of Object.keys(FACET_INFO) as ComparisonFacet[]) {
        const label = facetLabels[facet]?.label ?? facet
        expect(component.text()).toContain(label)
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

  describe.runIf(hasComingSoonFacets)('comingSoon facets', () => {
    it('disables comingSoon facets', async () => {
      const component = await mountSuspended(FacetSelector)

      // totalDependencies is marked as comingSoon
      const buttons = component.findAll('button')
      const comingSoonButton = buttons.find(b => b.text().includes(comingSoonFacetLabel))

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
      const comingSoonButton = buttons.find(b => b.text().includes(comingSoonFacetLabel))

      // Should not have checkmark or add icon
      expect(comingSoonButton?.find('.i-carbon\\:checkmark').exists()).toBe(false)
      expect(comingSoonButton?.find('.i-carbon\\:add').exists()).toBe(false)
    })

    it('does not call toggleFacet when comingSoon facet is clicked', async () => {
      const component = await mountSuspended(FacetSelector)

      const buttons = component.findAll('button')
      const comingSoonButton = buttons.find(b => b.text().includes(comingSoonFacetLabel))
      await comingSoonButton?.trigger('click')

      // toggleFacet should not have been called with totalDependencies
      expect(mockToggleFacet).not.toHaveBeenCalledWith(comingSoonFacetId)
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
      const performanceFacets: (string | ComparisonFacet)[] = FACETS_BY_CATEGORY.performance.filter(
        f => !FACET_INFO[f].comingSoon,
      )
      mockSelectedFacets.value = performanceFacets
      mockIsFacetSelected.mockImplementation((f: string) => performanceFacets.includes(f))

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

    it.runIf(hasComingSoonFacets)('applies cursor-not-allowed to comingSoon facets', async () => {
      const component = await mountSuspended(FacetSelector)

      expect(component.find('.cursor-not-allowed').exists()).toBe(true)
    })
  })
})
