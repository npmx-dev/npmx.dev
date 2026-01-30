import { describe, expect, it } from 'vitest'
import {
  ALL_FACETS,
  CATEGORY_ORDER,
  DEFAULT_FACETS,
  FACET_INFO,
  FACETS_BY_CATEGORY,
  type ComparisonFacet,
} from '../../shared/types/comparison'

describe('comparison types', () => {
  describe('FACET_INFO', () => {
    it('defines all expected facets', () => {
      const expectedFacets: ComparisonFacet[] = [
        'packageSize',
        'installSize',
        'dependencies',
        'totalDependencies',
        'downloads',
        'lastUpdated',
        'deprecated',
        'engines',
        'types',
        'moduleFormat',
        'license',
        'vulnerabilities',
      ]

      for (const facet of expectedFacets) {
        expect(FACET_INFO[facet]).toBeDefined()
        expect(FACET_INFO[facet].label).toBeTruthy()
        expect(FACET_INFO[facet].description).toBeTruthy()
        expect(FACET_INFO[facet].category).toBeTruthy()
      }
    })

    it('has valid categories for all facets', () => {
      const validCategories = ['performance', 'health', 'compatibility', 'security']

      for (const facet of ALL_FACETS) {
        expect(validCategories).toContain(FACET_INFO[facet].category)
      }
    })

    it('marks totalDependencies as comingSoon', () => {
      expect(FACET_INFO.totalDependencies.comingSoon).toBe(true)
    })
  })

  describe('CATEGORY_ORDER', () => {
    it('defines categories in correct order', () => {
      expect(CATEGORY_ORDER).toEqual(['performance', 'health', 'compatibility', 'security'])
    })
  })

  describe('ALL_FACETS', () => {
    it('contains all facets from FACET_INFO', () => {
      const facetInfoKeys = Object.keys(FACET_INFO) as ComparisonFacet[]
      expect(ALL_FACETS).toHaveLength(facetInfoKeys.length)
      for (const facet of facetInfoKeys) {
        expect(ALL_FACETS).toContain(facet)
      }
    })

    it('maintains order grouped by category', () => {
      // First facets should be performance
      const performanceFacets = FACETS_BY_CATEGORY.performance
      expect(ALL_FACETS.slice(0, performanceFacets.length)).toEqual(performanceFacets)
    })
  })

  describe('DEFAULT_FACETS', () => {
    it('excludes comingSoon facets', () => {
      for (const facet of DEFAULT_FACETS) {
        expect(FACET_INFO[facet].comingSoon).not.toBe(true)
      }
    })

    it('includes all non-comingSoon facets', () => {
      const nonComingSoonFacets = ALL_FACETS.filter(f => !FACET_INFO[f].comingSoon)
      expect(DEFAULT_FACETS).toEqual(nonComingSoonFacets)
    })

    it('does not include totalDependencies', () => {
      expect(DEFAULT_FACETS).not.toContain('totalDependencies')
    })
  })

  describe('FACETS_BY_CATEGORY', () => {
    it('groups all facets by their category', () => {
      for (const category of CATEGORY_ORDER) {
        const facetsInCategory = FACETS_BY_CATEGORY[category]
        expect(facetsInCategory.length).toBeGreaterThan(0)

        for (const facet of facetsInCategory) {
          expect(FACET_INFO[facet].category).toBe(category)
        }
      }
    })

    it('contains all facets exactly once', () => {
      const allFacetsFromCategories = CATEGORY_ORDER.flatMap(cat => FACETS_BY_CATEGORY[cat])
      expect(allFacetsFromCategories).toHaveLength(ALL_FACETS.length)
      expect(new Set(allFacetsFromCategories).size).toBe(ALL_FACETS.length)
    })

    it('performance category has size and dependency facets', () => {
      expect(FACETS_BY_CATEGORY.performance).toContain('packageSize')
      expect(FACETS_BY_CATEGORY.performance).toContain('installSize')
      expect(FACETS_BY_CATEGORY.performance).toContain('dependencies')
    })

    it('health category has downloads and update facets', () => {
      expect(FACETS_BY_CATEGORY.health).toContain('downloads')
      expect(FACETS_BY_CATEGORY.health).toContain('lastUpdated')
      expect(FACETS_BY_CATEGORY.health).toContain('deprecated')
    })

    it('compatibility category has module and type facets', () => {
      expect(FACETS_BY_CATEGORY.compatibility).toContain('moduleFormat')
      expect(FACETS_BY_CATEGORY.compatibility).toContain('types')
      expect(FACETS_BY_CATEGORY.compatibility).toContain('engines')
    })

    it('security category has license and vulnerability facets', () => {
      expect(FACETS_BY_CATEGORY.security).toContain('license')
      expect(FACETS_BY_CATEGORY.security).toContain('vulnerabilities')
    })
  })
})
