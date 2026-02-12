import { normalizeSearchParam } from '#shared/utils/url'
import { debounce } from 'perfect-debounce'

// Pages that have their own local filter using ?q
const pagesWithLocalFilter = new Set(['~username', 'org'])

export function useGlobalSearch() {
  const { searchProvider } = useSearchProvider()
  const searchProviderValue = computed(() => {
    const p = normalizeSearchParam(route.query.p)
    if (p === 'npm' || searchProvider.value === 'npm') return 'npm'
    return 'algolia'
  })
  const router = useRouter()
  const route = useRoute()
  const searchQuery = useState<string>('search-query', () => {
    if (pagesWithLocalFilter.has(route.name as string)) {
      return ''
    }
    return normalizeSearchParam(route.query.q)
  })

  // clean search input when navigating away from search page
  watch(
    () => route.query.q,
    urlQuery => {
      const value = normalizeSearchParam(urlQuery)
      if (!value) searchQuery.value = ''
    },
  )
  const updateUrlQueryImpl = (value: string, provider: 'npm' | 'algolia') => {
    const isSameQuery = route.query.q === value && route.query.p === provider
    // Don't navigate away from pages that use ?q for local filtering
    if (pagesWithLocalFilter.has(route.name as string) || isSameQuery) {
      return
    }

    if (route.name === 'search') {
      router.replace({
        query: {
          ...route.query,
          q: value || undefined,
          p: provider === 'npm' ? 'npm' : undefined,
        },
      })
      return
    }
    router.push({
      name: 'search',
      query: {
        q: value,
        p: provider === 'npm' ? 'npm' : undefined,
      },
    })
  }
  const updateUrlQuery = debounce(updateUrlQueryImpl, 250)

  function flushUpdateUrlQuery() {
    updateUrlQuery.flush()
  }

  const searchQueryValue = computed({
    get: () => searchQuery.value,
    set: async (value: string) => {
      searchQuery.value = value

      // Leading debounce implementation as it doesn't work properly out of the box (https://github.com/unjs/perfect-debounce/issues/43)
      if (!updateUrlQuery.isPending()) {
        updateUrlQueryImpl(value, searchProvider.value)
      }
      updateUrlQuery(value, searchProvider.value)
    },
  })
  return { model: searchQueryValue, provider: searchProviderValue, flushUpdateUrlQuery }
}
