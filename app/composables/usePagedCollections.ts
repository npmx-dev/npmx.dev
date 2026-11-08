import type { CollectionSummary } from '#shared/types/social'

type Page = { cursor?: string; items: CollectionSummary[] }

/** A load-more list of collections, as used on profiles. */
export function usePagedCollections(fetchPage: (cursor: string | undefined) => Promise<Page>) {
  const items = ref<CollectionSummary[]>([])
  // undefined = not yet fetched, string = next page cursor, null = no more pages
  const cursor = shallowRef<string | null | undefined>(undefined)
  const error = shallowRef(false)
  const isLoading = shallowRef(false)

  async function load() {
    if (cursor.value === null || isLoading.value) return
    isLoading.value = true
    error.value = false
    try {
      const page = await fetchPage(cursor.value)
      items.value.push(...page.items)
      cursor.value = page.cursor ?? null
    } catch {
      error.value = true
    } finally {
      isLoading.value = false
    }
  }

  const hasMore = computed(() => typeof cursor.value === 'string')
  return { items, error, isLoading, hasMore, load }
}
