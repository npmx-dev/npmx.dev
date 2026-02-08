import { debounce } from 'perfect-debounce'

export function usePackageSearchQuery() {
  const searchQuery = useState<string>('package_search_query', () => '')

  const route = useRoute()
  onMounted(() => {
    if (route.query.q) {
      searchQuery.value = normalizeSearchParam(route.query.q)
    }
  })

  const updateSearchQuery = debounce((newSearchQuery: string) => {
    searchQuery.value = newSearchQuery
  }, 400)

  return {
    searchQuery,
    updateSearchQuery,
  }
}
