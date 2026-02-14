---
name: nuxt-perf-review
description: >
  Review and audit a Nuxt application for client-side and rendering performance optimizations.
  Use when asked to "review performance", "optimize my Nuxt app", "audit for speed",
  "improve TTFB", "reduce bundle size", "optimize data fetching", or any performance-related
  code review on a Nuxt 3/4 project. Covers ISR, SWR, getCachedData, lazy data fetching,
  shallowRef, view transitions, conditional fetching, and incremental loading patterns.
---

# Nuxt Performance Optimization Review

Audit a Nuxt application for performance optimizations. Scan the codebase for each pattern below, explain the concept, and propose fixes when the pattern is missing or misused.

For full code examples, see the `references/` files linked in each section.

## Review Process

1. Read `nuxt.config.ts` for route rules, experimental features, and rendering config
2. Scan `app/composables/` and `app/pages/` for data fetching patterns
3. Check for `shallowRef` vs `ref` usage across components and composables
4. Report findings with explanations and suggested fixes

---

## 1. ISR Route Rules

**What:** Incremental Static Regeneration (ISR) pre-renders pages on first request, then serves the cached version for subsequent requests. After a configurable TTL (e.g., 60 seconds), the next request triggers a background regeneration while still serving the stale page instantly.

**Why:** Without ISR, every request either hits SSR (slow TTFB, high server cost) or serves a fully static page (stale data). ISR gives the best of both: instant responses with fresh-enough data.

**What to look for:** Check `routeRules` in `nuxt.config.ts`. Dynamic pages (e.g., `/product/[id]`) should have `isr` with an expiration. Static pages should use `prerender: true`. Auth/search routes should have `isr: false, cache: false`.

**Good:**

```ts
// nuxt.config.ts
routeRules: {
  '/product/:id': { isr: { expiration: 60 } },       // revalidate every 60s
  '/docs/**': { isr: true, cache: { maxAge: 31536000 } }, // immutable content
  '/': { prerender: true },                            // fully static
  '/search': { isr: false, cache: false },             // never cache
  '/api/auth/**': { isr: false, cache: false },        // never cache auth
}
```

**Bad:**

```ts
// No routeRules at all, or only prerender for everything
routeRules: {
  '/': { prerender: true },
  // Dynamic pages have no ISR config -> full SSR on every request
}
```

**Fix:** Add `isr` rules for dynamic pages. Use `prerender: true` for static pages. Disable caching for auth and real-time routes. See [references/isr-patterns.md](references/isr-patterns.md) for advanced patterns (SPA fallback, query-aware ISR).

---

## 2. getCachedData for Navigation Caching

**What:** `getCachedData` is a `useFetch`/`useAsyncData` option that checks Nuxt's payload cache before making a new request. On client-side navigation, data already fetched during SSR or a previous navigation is returned instantly without a network call.

**Why:** Without `getCachedData`, navigating back to a previously visited page triggers a new API call, causing loading spinners and wasted bandwidth. With it, the page renders instantly from cache.

**What to look for:** Search for `useFetch` and `useLazyFetch` calls. If the data rarely changes (avatars, config, metadata), add `getCachedData`.

**Good:**

```ts
const { data } = useFetch('/api/settings', {
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
})
```

**Bad:**

```ts
// No getCachedData -> refetches on every navigation
const { data } = useFetch('/api/settings')
```

**Fix:** Add `getCachedData` to `useFetch`/`useLazyFetch` calls where data does not change frequently. See [references/client-caching-patterns.md](references/client-caching-patterns.md).

---

## 3. Client-Side Stale-While-Revalidate

**What:** When the server returns data from a stale cache (past TTL but still usable), the response includes an `isStale` flag. On the client, detect this flag and trigger a background `refresh()` after mount to get fresh data without blocking the initial render.

**Why:** The user sees content instantly (even if slightly stale), and the page silently updates with fresh data in the background. This eliminates perceived loading time.

**What to look for:** Search for composables that fetch external API data. Check if they propagate staleness metadata and trigger `refresh()` on mount when stale.

**Good:**

```ts
export function useProduct(id: MaybeRefOrGetter<string>) {
  const cachedFetch = useCachedFetch()

  const asyncData = useLazyAsyncData(
    () => `product:${toValue(id)}`,
    async () => {
      const { data, isStale } = await cachedFetch(`/api/products/${toValue(id)}`)
      return { ...data, isStale }
    },
  )

  // If SSR returned stale data, silently refresh on mount
  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => asyncData.refresh())
  }

  return asyncData
}
```

**Bad:**

```ts
// No stale detection -> user either sees old data forever or waits for fresh data
const { data } = useFetch('/api/products/' + id)
```

**Fix:** Propagate staleness from server cache, detect it on client, and call `refresh()` on mount. See [references/client-caching-patterns.md](references/client-caching-patterns.md).

---

## 4. useLazyAsyncData / useLazyFetch for Non-Blocking Data

**What:** `useLazyFetch` and `useLazyAsyncData` fetch data without blocking the page render. The page displays immediately with `null` data, which fills in as requests complete. This is ideal for secondary/supplementary data.

**Why:** If a page fetches 5 different APIs with `useFetch`, the page waits for ALL of them before rendering. Using `useLazyFetch` for non-critical data (README, stats, related items) lets the page render with the critical data first.

**What to look for:** Pages with multiple `useFetch` calls. Identify which data is critical (needed for the page to make sense) vs. supplementary (can load after render).

**Good:**

```ts
// Critical data - blocks render
const { data: product } = await useFetch(`/api/product/${id}`)

// Supplementary data - loads after render
const { data: readme } = useLazyFetch(`/api/product/${id}/readme`, {
  default: () => ({ html: '' }),
})
const { data: stats } = useLazyFetch(`/api/product/${id}/stats`, {
  server: false, // skip SSR entirely
  immediate: false, // don't fetch until triggered
})
onMounted(() => stats.execute())
```

**Bad:**

```ts
// All blocking -> page waits for everything
const { data: product } = await useFetch(`/api/product/${id}`)
const { data: readme } = await useFetch(`/api/product/${id}/readme`)
const { data: stats } = await useFetch(`/api/product/${id}/stats`)
```

**Fix:** Convert supplementary fetches to `useLazyFetch`. Use `server: false` + `immediate: false` for client-only data that can be deferred. See [references/data-fetching-patterns.md](references/data-fetching-patterns.md).

---

## 5. shallowRef Over ref for Non-Deep State

**What:** `shallowRef` creates a ref that only triggers reactivity when the `.value` itself is reassigned, not when nested properties change. For primitive values, Maps, arrays used as caches, or objects that are always replaced (never mutated), `shallowRef` avoids Vue wrapping every nested property in a Proxy.

**Why:** `ref` deeply proxies the entire object tree. For a `Map` with 1000 entries or an array of search results, this creates thousands of Proxy objects. `shallowRef` avoids this overhead entirely.

**What to look for:** Search for `ref(` in composables. Check if the value is: a boolean, a number, a string, a Map/Set, or an object that is always replaced wholesale. If so, it should be `shallowRef`.

**Good:**

```ts
const isOpen = shallowRef(false)
const cache = shallowRef(new Map<string, Data>())
const results = shallowRef<SearchResult[]>([])

// Replace the whole value to trigger reactivity
results.value = [...results.value, ...newResults]
```

**Bad:**

```ts
const isOpen = ref(false) // Deep proxy on a boolean is wasteful
const cache = ref(new Map()) // Deep proxy on a Map is expensive
const results = ref<SearchResult[]>([]) // Deep proxy on array of objects
```

**Fix:** Replace `ref` with `shallowRef` for primitives, Maps, Sets, and objects that are replaced (not mutated). See [references/client-caching-patterns.md](references/client-caching-patterns.md).

---

## 6. View Transitions API

**What:** The View Transitions API provides native browser animations between page navigations in SSR-rendered apps. Nuxt supports it via `experimental.viewTransition`.

**Why:** Gives smooth cross-fade transitions between pages with zero JavaScript animation overhead. Handled entirely by the browser.

**What to look for:** Check `nuxt.config.ts` for `experimental.viewTransition`.

**Good:**

```ts
// nuxt.config.ts
experimental: {
  viewTransition: true,
}
```

**Fix:** Add `viewTransition: true` to the experimental config. Works out of the box for page transitions.

---

## 7. Conditional / Deferred Fetching

**What:** Use the `immediate` option on `useLazyFetch` to conditionally skip fetches that aren't needed. For example, only fetch JSR data for scoped packages, or only fetch install size after the component mounts.

**Why:** Avoids unnecessary network requests, reducing server load and improving page load time.

**What to look for:** `useFetch` calls that always execute but only make sense under certain conditions.

**Good:**

```ts
// Only fetch for scoped packages
const { data } = useLazyFetch(() => `/api/jsr/${name}`, {
  immediate: computed(() => name.value.startsWith('@')).value,
})

// Only fetch on client after mount
const { data, execute } = useLazyFetch(`/api/heavy-data`, {
  server: false,
  immediate: false,
})
onMounted(() => execute())
```

**Bad:**

```ts
// Fetches for every package, even non-scoped ones where it will 404
const { data } = useFetch(() => `/api/jsr/${name}`)
```

**Fix:** Add `immediate: false` or `immediate: computed(...)` to skip unnecessary fetches. Use `server: false` for client-only data. See [references/data-fetching-patterns.md](references/data-fetching-patterns.md).

---

## 8. Incremental Loading / Infinite Scroll

**What:** Instead of fetching all results at once, fetch an initial batch and provide a `fetchMore()` function that appends results incrementally. The composable manages a local cache to merge pages.

**Why:** Fetching 500 search results on initial load is slow and wastes bandwidth. Fetching 25 at a time and loading more on scroll is faster and more responsive.

**What to look for:** Search/list pages that fetch all results in one call. Check if there is infinite scroll or pagination support.

**Good:**

```ts
const cache = shallowRef<Result[]>([])

async function fetchMore(targetSize: number) {
  const from = cache.value.length
  const response = await fetch(`/api/search?from=${from}&size=25`)
  cache.value = [...cache.value, ...response.results]
}
```

**Bad:**

```ts
// Fetches everything at once
const { data } = useFetch(`/api/search?size=500`)
```

**Fix:** Implement incremental loading with a local cache and `fetchMore()` function. See [references/data-fetching-patterns.md](references/data-fetching-patterns.md) for the full pattern.
