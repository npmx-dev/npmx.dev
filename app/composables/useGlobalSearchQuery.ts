import { normalizeSearchParam } from '#shared/utils/url'

export function useGlobalSearchQuery() {
  const route = useRoute()
  const searchQuery = useState<string>('search-query', () => normalizeSearchParam(route.query.q))

  // clean search input when navigating away from search page
  watch(
    () => route.query.q,
    urlQuery => {
      const value = normalizeSearchParam(urlQuery)
      if (!value) searchQuery.value = ''
    },
  )
  return searchQuery
}
