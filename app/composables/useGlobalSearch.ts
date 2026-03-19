import { normalizeSearchParam } from '#shared/utils/url'
import { nextTick } from 'vue'
import { debounce } from 'perfect-debounce'

// Pages that have their own local filter using ?q
const pagesWithLocalFilter = new Set(['~username', 'org'])

export function useGlobalSearch(place: 'header' | 'content' = 'content') {
  const { settings } = useSettings()
  const { searchProvider } = useSearchProvider()
  const searchProviderValue = computed(() => {
    const p = normalizeSearchParam(route.query.p)
    if (p === 'npm' || searchProvider.value === 'npm') return 'npm'
    return 'algolia'
  })

  const router = useRouter()
  const route = useRoute()
  const getFocusedSearchInputValue = () => {
    if (!import.meta.client) return ''

    const active = document.activeElement
    if (!(active instanceof HTMLInputElement)) return ''
    if (active.type !== 'search' && active.name !== 'q') return ''
    return active.value
  }
  // Internally used searchQuery state
  const searchQuery = useState<string>('search-query', () => {
    // Preserve fast typing before hydration (e.g. homepage autofocus search input).
    const focusedInputValue = getFocusedSearchInputValue()
    if (focusedInputValue) {
      return focusedInputValue
    }

    if (pagesWithLocalFilter.has(route.name as string)) {
      return ''
    }
    return normalizeSearchParam(route.query.q)
  })

  // Committed search query: last value submitted by user
  // Syncs instantly when instantSearch is on, but only on Enter press when off
  const committedSearchQuery = useState<string>('committed-search-query', () => searchQuery.value)

  // This is basically doing instant search as user types
  watch(searchQuery, val => {
    if (settings.value.instantSearch) {
      committedSearchQuery.value = val
    }
  })

  // Sync URL query to input state only on search page.
  // On other pages (e.g. home), keep the user's in-progress typing untouched.
  watch(
    () => [route.name, route.query.q] as const,
    ([routeName, urlQuery]) => {
      if (routeName !== 'search') return

      // Never clobber in-progress typing while any search input is focused.
      if (import.meta.client) {
        const active = document.activeElement
        if (
          active instanceof HTMLInputElement &&
          (active.type === 'search' || active.name === 'q')
        ) {
          return
        }
      }

      const value = normalizeSearchParam(urlQuery)
      if (searchQuery.value !== value) {
        searchQuery.value = value
      }
    },
  )

  // Updates URL when search query changes (immediately for instantSearch or after Enter hit otherwise)
  const updateUrlQueryImpl = (value: string, provider: 'npm' | 'algolia') => {
    const isSameQuery = route.query.q === value && route.query.p === provider
    // Don't navigate away from pages that use ?q for local filtering
    if ((pagesWithLocalFilter.has(route.name as string) && place === 'content') || isSameQuery) {
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
    // Commit the current query when explicitly submitted (Enter pressed)
    committedSearchQuery.value = searchQuery.value
    // When instant search is off the debounce queue is empty, so call directly
    if (!settings.value.instantSearch) {
      updateUrlQueryImpl(searchQuery.value, searchProvider.value)
    } else {
      updateUrlQuery.flush()
    }
  }

  const searchQueryValue = computed({
    get: () => searchQuery.value,
    set: async (value: string) => {
      searchQuery.value = value

      // When instant search is off, skip debounced URL updates
      // Only explicitly called flushUpdateUrlQuery commits and navigates
      if (!settings.value.instantSearch) return

      // Leading debounce implementation as it doesn't work properly out of the box (https://github.com/unjs/perfect-debounce/issues/43)
      if (!updateUrlQuery.isPending()) {
        updateUrlQueryImpl(value, searchProvider.value)
      }
      updateUrlQuery(value, searchProvider.value)
    },
  })

  // When navigating back to the homepage (e.g. via logo click from /search),
  // reset the global search state so the home input starts fresh and re-focus
  // the dedicated home search input.
  if (import.meta.client) {
    watch(
      () => route.name,
      name => {
        if (name !== 'index') return
        searchQuery.value = ''
        committedSearchQuery.value = ''
        // Use nextTick so we run after the homepage has rendered.
        nextTick(() => {
          const homeInput = document.getElementById('home-search')
          if (homeInput instanceof HTMLInputElement) {
            homeInput.focus()
            homeInput.select()
          }
        })
      },
      { flush: 'post' },
    )
  }

  // On hydration, useState can reuse SSR payload (often empty), skipping initializer.
  // Recover fast-typed value from the focused input once on client mount.
  if (import.meta.client) {
    onMounted(() => {
      const focusedInputValue = getFocusedSearchInputValue()
      if (!focusedInputValue) return
      if (searchQuery.value) return

      // Use model setter path to preserve instant-search behavior.
      searchQueryValue.value = focusedInputValue
    })
  }

  return {
    model: searchQueryValue,
    committedModel: committedSearchQuery,
    provider: searchProviderValue,
    startSearch: flushUpdateUrlQuery,
  }
}
