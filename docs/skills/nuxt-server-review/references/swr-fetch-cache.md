# SWR Fetch Cache Reference

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Fetch Cache Config](#fetch-cache-config)
- [Nitro Plugin Implementation](#nitro-plugin-implementation)
- [useCachedFetch Composable Bridge](#usecachedfetch-composable-bridge)
- [Integration in Composables](#integration-in-composables)

---

## Architecture Overview

```
                        Server (SSR)                              Client
  ┌─────────────────────────────────────────────┐
  │  Composable                                  │
  │    │                                         │
  │    ▼                                         │
  │  useCachedFetch() ◄── useRequestEvent()      │     useCachedFetch()
  │    │                   event.context          │       │
  │    ▼                                         │       ▼
  │  cachedFetch(url)                            │     $fetch(url)
  │    │                                         │     (no caching)
  │    ├── isAllowedDomain? ──No──► $fetch(url)  │
  │    │                                         │
  │    ├── Cache HIT (fresh)? ──► return data    │
  │    │                                         │
  │    ├── Cache HIT (stale)?                    │
  │    │     ├── return stale data immediately   │
  │    │     └── event.waitUntil(revalidate)     │
  │    │                                         │
  │    └── Cache MISS?                           │
  │          ├── $fetch + return data            │
  │          └── event.waitUntil(cache write)    │
  └─────────────────────────────────────────────┘
```

---

## Fetch Cache Config

Shared configuration used by both the plugin and composable:

```ts
// shared/utils/fetch-cache-config.ts

// Only cache responses from these domains
export const FETCH_CACHE_ALLOWED_DOMAINS = [
  'registry.npmjs.org',
  'api.npmjs.org',
  'api.github.com',
  // Add your external API domains here
] as const

// Default TTL: 5 minutes
export const FETCH_CACHE_DEFAULT_TTL = 60 * 5

// Increment to invalidate all cached entries
export const FETCH_CACHE_VERSION = 'v1'

// Nitro storage key
export const FETCH_CACHE_STORAGE_BASE = 'fetch-cache'

export function isAllowedDomain(url: string | URL): boolean {
  try {
    const urlObj = typeof url === 'string' ? new URL(url) : url
    return FETCH_CACHE_ALLOWED_DOMAINS.some(domain => urlObj.host === domain)
  } catch {
    return false
  }
}

export interface CachedFetchEntry<T = unknown> {
  data: T
  status: number
  headers: Record<string, string>
  cachedAt: number
  ttl: number
}

export function isCacheEntryStale(entry: CachedFetchEntry): boolean {
  return Date.now() > entry.cachedAt + entry.ttl * 1000
}

export interface CachedFetchResult<T> {
  data: T
  isStale: boolean
  cachedAt: number | null
}

export type CachedFetchFunction = <T = unknown>(
  url: string,
  options?: Parameters<typeof $fetch>[1],
  ttl?: number,
) => Promise<CachedFetchResult<T>>
```

---

## Nitro Plugin Implementation

```ts
// server/plugins/fetch-cache.ts
import type { H3Event } from 'h3'
import type { CachedFetchEntry, CachedFetchResult } from '#shared/utils/fetch-cache-config'
import { $fetch } from 'ofetch'
import {
  FETCH_CACHE_DEFAULT_TTL,
  FETCH_CACHE_STORAGE_BASE,
  FETCH_CACHE_VERSION,
  isAllowedDomain,
  isCacheEntryStale,
} from '#shared/utils/fetch-cache-config'

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

function generateCacheKey(url: string, method: string, body?: unknown): string {
  const urlObj = new URL(url)
  return [
    FETCH_CACHE_VERSION,
    urlObj.host,
    method.toUpperCase(),
    urlObj.pathname,
    urlObj.search ? simpleHash(urlObj.search) : '',
    body ? simpleHash(JSON.stringify(body)) : '',
  ]
    .filter(Boolean)
    .join(':')
}

export default defineNitroPlugin(nitroApp => {
  const storage = useStorage(FETCH_CACHE_STORAGE_BASE)

  function createCachedFetch(event: H3Event): CachedFetchFunction {
    return async <T = unknown>(
      url: string,
      options: Parameters<typeof $fetch>[1] = {},
      ttl: number = FETCH_CACHE_DEFAULT_TTL,
    ): Promise<CachedFetchResult<T>> => {
      // Skip caching for non-allowed domains
      if (!isAllowedDomain(url)) {
        const data = (await $fetch(url, options)) as T
        return { data, isStale: false, cachedAt: null }
      }

      const cacheKey = generateCacheKey(url, options.method || 'GET', options.body)

      // Try cache (with error tolerance)
      let cached: CachedFetchEntry<T> | null = null
      try {
        cached = await storage.getItem<CachedFetchEntry<T>>(cacheKey)
      } catch {
        /* storage failure - continue without cache */
      }

      if (cached) {
        if (!isCacheEntryStale(cached)) {
          // Fresh hit
          return { data: cached.data, isStale: false, cachedAt: cached.cachedAt }
        }

        // Stale hit - return stale data, revalidate in background
        event.waitUntil(
          (async () => {
            try {
              const freshData = (await $fetch(url, options)) as T
              await storage.setItem(cacheKey, {
                data: freshData,
                status: 200,
                headers: {},
                cachedAt: Date.now(),
                ttl,
              })
            } catch {
              /* revalidation failed - keep stale data */
            }
          })(),
        )
        return { data: cached.data, isStale: true, cachedAt: cached.cachedAt }
      }

      // Cache miss - fetch, cache in background
      const data = (await $fetch(url, options)) as T
      const cachedAt = Date.now()
      event.waitUntil(
        storage
          .setItem(cacheKey, {
            data,
            status: 200,
            headers: {},
            cachedAt,
            ttl,
          })
          .catch(() => {}),
      )
      return { data, isStale: false, cachedAt }
    }
  }

  // Attach to every request
  nitroApp.hooks.hook('request', event => {
    event.context.cachedFetch ||= createCachedFetch(event)
  })
})

// Extend H3 types
declare module 'h3' {
  interface H3EventContext {
    cachedFetch?: CachedFetchFunction
  }
}
```

### Key design decisions

1. **Domain allowlist** -- Only caches external API calls to known domains, not internal routes
2. **`event.waitUntil()`** -- Background cache writes and revalidation work in serverless environments where the process may terminate after the response is sent
3. **Error tolerance** -- Cache read/write failures are logged but never break the request
4. **Stale metadata** -- `isStale` flag propagates to composables for client-side revalidation

---

## useCachedFetch Composable Bridge

```ts
// app/composables/useCachedFetch.ts
import type { CachedFetchResult } from '#shared/utils/fetch-cache-config'

export function useCachedFetch(): CachedFetchFunction {
  // Client: no caching, just use $fetch
  if (import.meta.client) {
    return async <T = unknown>(
      url: string,
      options: Parameters<typeof $fetch>[1] = {},
    ): Promise<CachedFetchResult<T>> => {
      const data = (await $fetch<T>(url, options)) as T
      return { data, isStale: false, cachedAt: null }
    }
  }

  // Server: get cachedFetch from Nitro plugin via event context
  const event = useRequestEvent()
  const serverCachedFetch = event?.context?.cachedFetch
  if (serverCachedFetch) {
    return serverCachedFetch as CachedFetchFunction
  }

  // Fallback: regular $fetch
  return async <T = unknown>(
    url: string,
    options: Parameters<typeof $fetch>[1] = {},
  ): Promise<CachedFetchResult<T>> => {
    const data = (await $fetch<T>(url, options)) as T
    return { data, isStale: false, cachedAt: null }
  }
}
```

### Important: call in setup context

`useCachedFetch()` must be called in the composable's setup scope (outside of async handlers), because `useRequestEvent()` only works in setup context. The returned function can then be used inside `useAsyncData` handlers.

---

## Integration in Composables

```ts
export function useProduct(id: MaybeRefOrGetter<string>) {
  // 1. Get cachedFetch in setup context
  const cachedFetch = useCachedFetch()

  // 2. Use it inside the async handler
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

  // 3. Client-side: refresh if data was stale
  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => asyncData.refresh())
  }

  return asyncData
}
```
