# Data Fetching Patterns Reference

## Table of Contents

- [Lazy vs Blocking Fetch Strategy](#lazy-vs-blocking-fetch-strategy)
- [Conditional / Deferred Fetching](#conditional--deferred-fetching)
- [Incremental Loading with fetchMore](#incremental-loading-with-fetchmore)
- [Payload Optimization with Transform](#payload-optimization-with-transform)

---

## Lazy vs Blocking Fetch Strategy

### Decision guide

For each `useFetch` on a page, ask: "Can the page render meaningfully without this data?"

| Data                       | Strategy                            | Reason                         |
| -------------------------- | ----------------------------------- | ------------------------------ |
| Product name, price, image | `useFetch` (blocking)               | Page makes no sense without it |
| README / documentation     | `useLazyFetch`                      | Page renders; README fills in  |
| Download stats             | `useLazyFetch` + `server: false`    | Not needed for SEO             |
| Install size (slow API)    | `useLazyFetch` + `immediate: false` | Only load on demand            |
| Related packages           | `useLazyFetch`                      | Supplementary content          |

### Example: page with mixed strategies

```vue
<script setup lang="ts">
// CRITICAL: blocks render - needed for page to make sense
const { data: product } = await useFetch(`/api/product/${id}`)

// SUPPLEMENTARY: renders after page is visible
const { data: readme } = useLazyFetch(`/api/product/${id}/readme`, {
  default: () => ({ html: '', toc: [] }),
})

// CLIENT-ONLY: not needed for SEO, skip SSR entirely
const { data: stats } = useLazyFetch(`/api/product/${id}/stats`, {
  default: () => null,
  server: false,
})

// DEFERRED: heavy computation, only fetch after mount
const { data: installSize, execute: fetchInstallSize } = useLazyFetch(
  `/api/product/${id}/install-size`,
  { server: false, immediate: false },
)
onMounted(() => fetchInstallSize())
</script>
```

---

## Conditional / Deferred Fetching

### Skip fetches based on reactive conditions

```ts
// Only fetch for scoped packages (starts with @)
const { data: jsrInfo } = useLazyFetch(() => `/api/jsr/${name.value}`, {
  default: () => ({ exists: false }),
  immediate: computed(() => name.value.startsWith('@')).value,
})
```

### Defer heavy fetches to after mount

```ts
const {
  data: installSize,
  status: installSizeStatus,
  execute: fetchInstallSize,
} = useLazyFetch(`/api/install-size/${name.value}`, {
  server: false, // skip SSR - not needed for initial HTML
  immediate: false, // don't fetch until told
})

// Trigger after the page has rendered
onMounted(() => fetchInstallSize())
```

### Conditionally fetch in a watcher

```ts
const shouldFetchDetails = computed(() => activeTab.value === 'details')

watch(shouldFetchDetails, shouldFetch => {
  if (shouldFetch && !detailsData.value) {
    fetchDetails()
  }
})
```

---

## Incremental Loading with fetchMore

### Architecture

```
Initial load:  fetch 25 results -> cache.value = [0..24]
User scrolls:  fetchMore(50)    -> cache.value = [0..49]
User scrolls:  fetchMore(75)    -> cache.value = [0..74]
```

### Full composable pattern

```ts
export function useSearch(query: MaybeRefOrGetter<string>) {
  const cachedFetch = useCachedFetch()
  const cache = shallowRef<{ query: string; items: Result[]; total: number } | null>(null)
  const isLoadingMore = shallowRef(false)

  const asyncData = useLazyAsyncData(
    () => `search:${toValue(query)}`,
    async (_nuxtApp, { signal }) => {
      const q = toValue(query)
      if (!q.trim()) return { items: [], total: 0 }

      cache.value = null // Reset cache for new query

      const params = new URLSearchParams({ text: q, size: '25' })
      const { data: response } = await cachedFetch<SearchResponse>(
        `/api/search?${params}`,
        { signal },
        60,
      )

      cache.value = { query: q, items: response.items, total: response.total }
      return response
    },
    { default: () => ({ items: [], total: 0 }) },
  )

  async function fetchMore(targetSize: number) {
    const q = toValue(query).trim()
    if (!q || !cache.value) return

    const currentCount = cache.value.items.length
    if (currentCount >= targetSize || currentCount >= cache.value.total) return

    isLoadingMore.value = true
    try {
      const from = currentCount
      const size = Math.min(targetSize - currentCount, cache.value.total - currentCount)
      const params = new URLSearchParams({ text: q, size: String(size), from: String(from) })
      const { data: response } = await cachedFetch<SearchResponse>(`/api/search?${params}`, {}, 60)

      // Deduplicate and append
      const existingIds = new Set(cache.value.items.map(i => i.id))
      const newItems = response.items.filter(i => !existingIds.has(i.id))
      cache.value = {
        query: q,
        items: [...cache.value.items, ...newItems],
        total: response.total,
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  const data = computed(() => {
    if (cache.value) return { items: cache.value.items, total: cache.value.total }
    return asyncData.data.value
  })

  const hasMore = computed(() => {
    if (!cache.value) return true
    return cache.value.items.length < cache.value.total
  })

  return { ...asyncData, data, isLoadingMore, hasMore, fetchMore }
}
```

### Key design decisions

1. **`shallowRef` for cache** -- Avoids deep proxying of the results array
2. **Deduplication** -- `existingIds` Set prevents duplicate items when pages overlap
3. **Computed `data`** -- Merges cache and asyncData transparently
4. **`isLoadingMore`** -- Separate from main `status` to show "loading more" vs "initial load"
5. **Query change resets cache** -- New query starts fresh

---

## Payload Optimization with Transform

### Reduce server-to-client payload by transforming data

When the API returns a large object but the component only needs a subset, use the `transform` option to strip unnecessary fields before they're serialized into the HTML payload:

```ts
export function usePackage(name: MaybeRefOrGetter<string>) {
  const cachedFetch = useCachedFetch()

  return useLazyAsyncData(
    () => `package:${toValue(name)}`,
    async () => {
      const { data: fullPackument } = await cachedFetch<Packument>(
        `https://registry.npmjs.org/${toValue(name)}`,
      )
      // Transform: only include the 5 most recent versions + dist-tags
      // instead of the full 500-version packument
      return transformPackument(fullPackument)
    },
  )
}
```

This can reduce payload size by 10x+ for packages with many versions.
