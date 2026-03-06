# Client Caching Patterns Reference

## Table of Contents

- [getCachedData Pattern](#getcacheddata-pattern)
- [Client-Side SWR with isStale](#client-side-swr-with-isstale)
- [shallowRef Optimization Guide](#shallowref-optimization-guide)

---

## getCachedData Pattern

Prevent refetching on client-side navigation by reading from Nuxt's payload cache.

### How it works

When Nuxt renders a page on the server, all `useFetch` data is serialized into `nuxtApp.payload.data`. On client-side navigation, `getCachedData` checks this cache first. If data exists, no network request is made.

### Basic pattern

```ts
const { data } = useFetch('/api/config', {
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
})
```

### When to use

- Data that rarely changes (user settings, app config, avatar URLs)
- Data already fetched by another component on the same page
- Lookups with stable keys (e.g., `/api/user/123`)

### When NOT to use

- Real-time data (chat, live feeds)
- Data that changes between navigations (search results with different queries)
- Data gated by auth state (may leak between users in SSR)

### With useLazyFetch

```ts
const { data: avatarUrl } = useLazyFetch(() => `/api/avatar/${username}`, {
  transform: res => res.url,
  getCachedData: (key, nuxtApp) => nuxtApp.static.data[key] ?? nuxtApp.payload.data[key],
})
```

---

## Client-Side SWR with isStale

Propagate staleness metadata from server cache to client and trigger background revalidation.

### Architecture

```
Server cache (SWR)        Composable             Client
  |                          |                      |
  |-- data + isStale ------->|                      |
  |                          |-- render stale ----->|
  |                          |-- onMounted -------->|
  |                          |   refresh()          |
  |<---- fresh fetch --------|                      |
  |                          |-- update UI -------->|
```

### Full pattern

```ts
export function useProduct(id: MaybeRefOrGetter<string>) {
  // Get cachedFetch in setup context (before async)
  const cachedFetch = useCachedFetch()

  const asyncData = useLazyAsyncData(
    () => `product:${toValue(id)}`,
    async (_nuxtApp, { signal }) => {
      const { data, isStale } = await cachedFetch<Product>(
        `https://api.example.com/products/${toValue(id)}`,
        { signal },
      )
      return { ...data, isStale }
    },
  )

  // On client: if the SSR data came from stale cache, refresh silently
  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  return asyncData
}
```

### Key points

1. `useCachedFetch()` must be called in setup context (not inside async handlers)
2. The `isStale` flag is returned by the server-side SWR cache plugin
3. `import.meta.client` guard ensures refresh only runs on client
4. `onMounted` ensures the DOM is ready before triggering a background fetch
5. The user sees stale content instantly, then it updates seamlessly

---

## shallowRef Optimization Guide

### When to use shallowRef

| Value Type                         | Use `shallowRef`? | Reason                                   |
| ---------------------------------- | ----------------- | ---------------------------------------- |
| `boolean`                          | Yes               | No nested props to track                 |
| `number` / `string`                | Yes               | Primitives don't benefit from deep proxy |
| `Map` / `Set`                      | Yes               | Vue proxies are expensive on collections |
| `Array<object>` replaced wholesale | Yes               | Full replacement triggers reactivity     |
| `null \| Object` toggled           | Yes               | Only null/object transition matters      |
| Object with mutated nested props   | No, use `ref`     | Need deep tracking for mutations         |

### Pattern: cache with shallowRef

```ts
// Cache that is always replaced, never mutated
const cache = shallowRef<Map<string, CachedItem>>(new Map())

// Update by creating a new Map
function addToCache(key: string, item: CachedItem) {
  const next = new Map(cache.value)
  next.set(key, item)
  cache.value = next // triggers reactivity
}
```

### Pattern: UI state with shallowRef

```ts
const isOpen = shallowRef(false)
const isLoading = shallowRef(false)
const currentPage = shallowRef(1)
const selectedTab = shallowRef<string | null>(null)
```

### Pattern: list results with shallowRef

```ts
const results = shallowRef<SearchResult[]>([])

// Append new results by replacing the array
results.value = [...results.value, ...newResults]

// Reset
results.value = []
```

### Impact

In a codebase with 100+ reactive variables, replacing `ref` with `shallowRef` where appropriate can reduce Vue's proxy overhead by 30-50%, especially for composables that manage large data structures (search results, dependency trees, file listings).
