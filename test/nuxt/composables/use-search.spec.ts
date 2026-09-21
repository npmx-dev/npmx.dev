import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { NpmSearchResponse } from '#shared/types'
import { useSearch } from '~/composables/npm/useSearch'

const { mockAlgoliaSearch, mockAlgoliaMultiSearch, mockUseAlgoliaSearch, mockUseNpmSearch } =
  vi.hoisted(() => ({
    mockAlgoliaSearch: vi.fn(),
    mockAlgoliaMultiSearch: vi.fn(),
    mockUseAlgoliaSearch: vi.fn(),
    mockUseNpmSearch: vi.fn(),
  }))

mockNuxtImport('useAlgoliaSearch', () => mockUseAlgoliaSearch)
mockNuxtImport('useNpmSearch', () => mockUseNpmSearch)

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAlgoliaSearch.mockReturnValue({
      search: mockAlgoliaSearch,
      searchWithSuggestions: mockAlgoliaMultiSearch,
    })

    mockUseNpmSearch.mockReturnValue({
      search: vi.fn(),
      checkOrgExists: vi.fn(),
      checkUserExists: vi.fn(),
    })
  })

  it('waits for a pending initial search before loading more results', async () => {
    const response: NpmSearchResponse = {
      isStale: false,
      objects: [
        {
          package: {
            name: 'nuxt',
            version: '4.0.0',
            date: '2026-01-01T00:00:00.000Z',
            links: {},
          },
        },
      ],
      total: 1,
      time: '2026-01-01T00:00:00.000Z',
    }

    const searchResult = {
      search: response,
      orgExists: false,
      userExists: false,
      packageExists: true,
    }

    let resolveInitialSearch!: (value: typeof searchResult) => void

    mockAlgoliaMultiSearch
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveInitialSearch = resolve
          }),
      )
      .mockResolvedValue(searchResult)

    mockAlgoliaSearch.mockResolvedValue(response)

    const size = ref(25)
    const result = useSearch(ref('nuxt'), ref('algolia'), () => ({ size: size.value }), {
      suggestions: true,
    })

    await vi.waitFor(() => {
      expect(mockAlgoliaMultiSearch).toHaveBeenCalled()
    })

    size.value = 50
    await nextTick()

    resolveInitialSearch(searchResult)

    await vi.waitFor(() => {
      expect(result.data.value?.objects.map(item => item.package.name)).toEqual(['nuxt'])
    })
  })
})
