import { describe, expect, it } from 'vitest'
import type { NpmSearchResult } from '#shared/types'

// Helper to create mock package results
function createPackage(overrides: {
  name: string
  description?: string
  keywords?: string[]
  downloads?: number
  updated?: string
  insecure?: number
}): NpmSearchResult {
  return {
    package: {
      name: overrides.name,
      version: '1.0.0',
      description: overrides.description ?? '',
      keywords: overrides.keywords ?? [],
      date: overrides.updated ?? '2024-01-01T00:00:00.000Z',
      links: { npm: '' },
      publisher: { username: 'test', email: '' },
      maintainers: [],
    },
    downloads: { weekly: overrides.downloads ?? 0 },
    updated: overrides.updated ?? '2024-01-01T00:00:00.000Z',
    flags: { insecure: overrides.insecure ?? 0 },
    score: { final: 0.5, detail: { quality: 0.5, popularity: 0.5, maintenance: 0.5 } },
    searchScore: 1000,
  }
}

describe('useStructuredFilters', () => {
  describe('keyword filtering (AND logic)', () => {
    it('returns all packages when no keywords selected', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['react'] }),
        createPackage({ name: 'pkg-b', keywords: ['vue'] }),
      ])

      const { sortedPackages } = useStructuredFilters({ packages })

      expect(sortedPackages.value).toHaveLength(2)
    })

    it('filters to packages with single keyword', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['react', 'hooks'] }),
        createPackage({ name: 'pkg-b', keywords: ['vue'] }),
      ])

      const { sortedPackages, addKeyword } = useStructuredFilters({ packages })
      addKeyword('react')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('pkg-a')
    })

    it('uses AND logic for multiple keywords', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['react', 'hooks'] }),
        createPackage({ name: 'pkg-b', keywords: ['react', 'state'] }),
        createPackage({ name: 'pkg-c', keywords: ['react', 'hooks', 'state'] }),
      ])

      const { sortedPackages, addKeyword } = useStructuredFilters({ packages })
      addKeyword('react')
      addKeyword('hooks')

      // Only packages with BOTH 'react' AND 'hooks'
      expect(sortedPackages.value).toHaveLength(2)
      expect(sortedPackages.value.map(p => p.package.name)).toContain('pkg-a')
      expect(sortedPackages.value.map(p => p.package.name)).toContain('pkg-c')
    })

    it('returns empty when no package has all keywords', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['react'] }),
        createPackage({ name: 'pkg-b', keywords: ['hooks'] }),
      ])

      const { sortedPackages, addKeyword } = useStructuredFilters({ packages })
      addKeyword('react')
      addKeyword('hooks')

      expect(sortedPackages.value).toHaveLength(0)
    })
  })

  describe('text filtering', () => {
    it('filters by name when scope is name', () => {
      const packages = ref([
        createPackage({ name: 'react-query', description: 'Data fetching' }),
        createPackage({ name: 'vue-query', description: 'Data fetching for Vue' }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('name')
      setTextFilter('react')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('react-query')
    })

    it('filters by description when scope is description', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', description: 'A React component library' }),
        createPackage({ name: 'pkg-b', description: 'A Vue component library' }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('description')
      setTextFilter('React')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('pkg-a')
    })

    it('filters by keywords when scope is keywords', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['typescript', 'react'] }),
        createPackage({ name: 'pkg-b', keywords: ['javascript', 'vue'] }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('keywords')
      setTextFilter('type')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('pkg-a')
    })

    it('filters by all fields when scope is all', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', description: 'foo', keywords: ['bar'] }),
        createPackage({ name: 'pkg-b', description: 'baz', keywords: ['qux'] }),
        createPackage({ name: 'search-term', description: 'other', keywords: [] }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('all')
      setTextFilter('search-term')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('search-term')
    })
  })

  describe('text filtering with operators', () => {
    it('parses name: operator in all scope', () => {
      const packages = ref([
        createPackage({ name: 'react-query', description: 'vue stuff' }),
        createPackage({ name: 'vue-query', description: 'react stuff' }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('all')
      setTextFilter('name:react')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('react-query')
    })

    it('parses desc: operator in all scope', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', description: 'A fantastic library' }),
        createPackage({ name: 'pkg-b', description: 'A mediocre library' }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('all')
      setTextFilter('desc:fantastic')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('pkg-a')
    })

    it('parses kw: operator in all scope', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['typescript'] }),
        createPackage({ name: 'pkg-b', keywords: ['javascript'] }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('all')
      setTextFilter('kw:typescript')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('pkg-a')
    })

    it('combines multiple operators with AND logic', () => {
      const packages = ref([
        createPackage({ name: 'react-lib', description: 'hooks library', keywords: ['react'] }),
        createPackage({ name: 'react-other', description: 'other stuff', keywords: ['react'] }),
        createPackage({ name: 'vue-lib', description: 'hooks library', keywords: ['vue'] }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('all')
      setTextFilter('name:react desc:hooks')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('react-lib')
    })

    it('handles comma-separated keyword values with OR logic', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['react'] }),
        createPackage({ name: 'pkg-b', keywords: ['vue'] }),
        createPackage({ name: 'pkg-c', keywords: ['angular'] }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('all')
      setTextFilter('kw:react,vue')

      expect(sortedPackages.value).toHaveLength(2)
      expect(sortedPackages.value.map(p => p.package.name)).toContain('pkg-a')
      expect(sortedPackages.value.map(p => p.package.name)).toContain('pkg-b')
    })

    it('combines operators with remaining text', () => {
      const packages = ref([
        createPackage({
          name: 'react-query',
          description: 'Data fetching library',
          keywords: ['react'],
        }),
        createPackage({ name: 'react-form', description: 'Form library', keywords: ['react'] }),
        createPackage({
          name: 'vue-query',
          description: 'Data fetching library',
          keywords: ['vue'],
        }),
      ])

      const { sortedPackages, setTextFilter, setSearchScope } = useStructuredFilters({ packages })
      setSearchScope('all')
      setTextFilter('name:react fetching')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('react-query')
    })
  })

  describe('download range filtering', () => {
    it('filters packages below threshold', () => {
      const packages = ref([
        createPackage({ name: 'popular', downloads: 50000 }),
        createPackage({ name: 'unpopular', downloads: 50 }),
      ])

      const { sortedPackages, setDownloadRange } = useStructuredFilters({ packages })
      setDownloadRange('gt100k')

      expect(sortedPackages.value).toHaveLength(0)
    })

    it('filters packages within range', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', downloads: 500 }),
        createPackage({ name: 'pkg-b', downloads: 5000 }),
        createPackage({ name: 'pkg-c', downloads: 50000 }),
      ])

      const { sortedPackages, setDownloadRange } = useStructuredFilters({ packages })
      setDownloadRange('1k-10k')

      expect(sortedPackages.value).toHaveLength(1)
      expect(sortedPackages.value[0]!.package.name).toBe('pkg-b')
    })
  })

  describe('sorting', () => {
    it('sorts by downloads descending by default with downloads sort', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', downloads: 100 }),
        createPackage({ name: 'pkg-b', downloads: 1000 }),
        createPackage({ name: 'pkg-c', downloads: 500 }),
      ])

      const { sortedPackages, setSort } = useStructuredFilters({ packages })
      setSort('downloads-week-desc')

      expect(sortedPackages.value[0]!.package.name).toBe('pkg-b')
      expect(sortedPackages.value[1]!.package.name).toBe('pkg-c')
      expect(sortedPackages.value[2]!.package.name).toBe('pkg-a')
    })

    it('sorts by name ascending', () => {
      const packages = ref([
        createPackage({ name: 'zlib' }),
        createPackage({ name: 'axios' }),
        createPackage({ name: 'lodash' }),
      ])

      const { sortedPackages, setSort } = useStructuredFilters({ packages })
      setSort('name-asc')

      expect(sortedPackages.value[0]!.package.name).toBe('axios')
      expect(sortedPackages.value[1]!.package.name).toBe('lodash')
      expect(sortedPackages.value[2]!.package.name).toBe('zlib')
    })

    it('sorts by updated date descending', () => {
      const packages = ref([
        createPackage({ name: 'old', updated: '2023-01-01T00:00:00.000Z' }),
        createPackage({ name: 'new', updated: '2024-06-01T00:00:00.000Z' }),
        createPackage({ name: 'mid', updated: '2024-01-01T00:00:00.000Z' }),
      ])

      const { sortedPackages, setSort } = useStructuredFilters({ packages })
      setSort('updated-desc')

      expect(sortedPackages.value[0]!.package.name).toBe('new')
      expect(sortedPackages.value[1]!.package.name).toBe('mid')
      expect(sortedPackages.value[2]!.package.name).toBe('old')
    })

    it('relevance sort preserves original order', () => {
      const packages = ref([
        createPackage({ name: 'first', downloads: 100 }),
        createPackage({ name: 'second', downloads: 1000 }),
        createPackage({ name: 'third', downloads: 500 }),
      ])

      const { sortedPackages, setSort } = useStructuredFilters({ packages })
      setSort('relevance-desc')

      // Relevance should preserve the original order from the server
      expect(sortedPackages.value[0]!.package.name).toBe('first')
      expect(sortedPackages.value[1]!.package.name).toBe('second')
      expect(sortedPackages.value[2]!.package.name).toBe('third')
    })
  })

  describe('clearing filters', () => {
    it('clearAllFilters resets all filters', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['react'], downloads: 1000 }),
        createPackage({ name: 'pkg-b', keywords: ['vue'], downloads: 500 }),
      ])

      const { sortedPackages, setTextFilter, addKeyword, setDownloadRange, clearAllFilters } =
        useStructuredFilters({ packages })

      setTextFilter('pkg-a')
      addKeyword('react')
      setDownloadRange('1k-10k')

      expect(sortedPackages.value).toHaveLength(1)

      clearAllFilters()

      expect(sortedPackages.value).toHaveLength(2)
    })

    it('removeKeyword removes specific keyword', () => {
      const packages = ref([
        createPackage({ name: 'pkg-a', keywords: ['react', 'hooks'] }),
        createPackage({ name: 'pkg-b', keywords: ['react'] }),
      ])

      const { sortedPackages, addKeyword, removeKeyword } = useStructuredFilters({ packages })

      addKeyword('react')
      addKeyword('hooks')
      expect(sortedPackages.value).toHaveLength(1)

      removeKeyword('hooks')
      expect(sortedPackages.value).toHaveLength(2)
    })
  })
})
