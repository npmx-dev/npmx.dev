# Cached Handlers Reference

## Table of Contents

- [defineCachedEventHandler Patterns](#definecachedeventhandler-patterns)
- [defineCachedFunction Patterns](#definecachedfunction-patterns)
- [Cache Key Design](#cache-key-design)
- [Multi-Layer Cache Module](#multi-layer-cache-module)

---

## defineCachedEventHandler Patterns

### Basic API route with SWR

```ts
// server/api/products/[id].get.ts
export default defineCachedEventHandler(
  async event => {
    const id = getRouterParam(event, 'id') ?? ''
    const params = v.parse(ProductIdSchema, id)

    const product = await $fetch(`https://api.example.com/products/${params}`)
    return product
  },
  {
    maxAge: 300, // Fresh for 5 minutes
    swr: true, // Serve stale while revalidating after 5 min
    getKey: event => {
      const id = getRouterParam(event, 'id') ?? ''
      return `product:v1:${id}` // Versioned cache key
    },
  },
)
```

### Long-lived cache for immutable content

```ts
// server/api/docs/[...path].get.ts
export default defineCachedEventHandler(
  async event => {
    const path = getRouterParam(event, 'path') ?? ''
    return await fetchDocumentation(path)
  },
  {
    maxAge: 86400, // 24 hours
    swr: true,
    getKey: event => {
      const path = getRouterParam(event, 'path') ?? ''
      return `docs:v1:${path.replace(/\/+$/, '').trim()}`
    },
  },
)
```

### Cache key with query parameters

```ts
{
  getKey: (event) => {
    const type = getRouterParam(event, 'type') ?? 'default'
    const pkg = getRouterParam(event, 'pkg') ?? ''
    const query = getQuery(event)
    return `badge:${type}:${pkg}:${hash(query)}`
  },
}
```

### Setting explicit response headers

```ts
export default defineCachedEventHandler(
  async (event) => {
    const svg = generateBadge(params)

    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control',
      `public, max-age=3600, s-maxage=3600`
    )

    return svg
  },
  { maxAge: 3600, swr: true, getKey: /* ... */ },
)
```

---

## defineCachedFunction Patterns

### Basic cached utility function

```ts
// server/utils/products.ts
export const fetchProduct = defineCachedFunction(
  async (name: string): Promise<Product> => {
    const encoded = encodeURIComponent(name)
    return await $fetch<Product>(`https://api.example.com/${encoded}`)
  },
  {
    maxAge: 300,
    swr: true,
    name: 'product', // Cache namespace
    getKey: (name: string) => name,
  },
)
```

### Cached function with error recovery

```ts
// server/utils/dependency-resolver.ts
export const fetchPackument = defineCachedFunction(
  async (name: string): Promise<Packument | null> => {
    try {
      return await $fetch<Packument>(`https://registry.npmjs.org/${encodePackageName(name)}`)
    } catch (error) {
      if (import.meta.dev) {
        console.warn(`Failed to fetch ${name}:`, error)
      }
      return null // Return null instead of throwing
    }
  },
  {
    maxAge: 3600,
    swr: true,
    name: 'packument',
    getKey: (name: string) => name,
  },
)
```

### Multiple cached functions with different TTLs

```ts
// Short TTL for frequently changing data
export const fetchLatestVersion = defineCachedFunction(
  async (name: string) => {
    /* ... */
  },
  { maxAge: 300, swr: true, name: 'latest-version', getKey: n => n },
)

// Long TTL for rarely changing data
export const fetchUserEmail = defineCachedFunction(
  async (username: string) => {
    /* ... */
  },
  { maxAge: 86400, swr: true, name: 'user-email', getKey: u => u.toLowerCase() },
)
```

---

## Cache Key Design

### Principles

1. **Version prefix** -- Include a version (e.g., `v1:`) so format changes can invalidate old entries
2. **Deterministic** -- Same input always produces the same key
3. **Normalized** -- Trim whitespace, normalize case, strip trailing slashes
4. **Namespaced** -- Use `name` option to separate different function caches

### Examples

```ts
// Good: versioned, normalized, unique
getKey: (name: string) => `product:v2:${name.trim().toLowerCase()}`

// Good: includes all varying parameters
getKey: event => {
  const pkg = getRouterParam(event, 'pkg') ?? ''
  return `readme:v8:${pkg.replace(/\/+$/, '').trim()}`
}

// Bad: no version, not normalized
getKey: (name: string) => name // "Vue" and "vue" get different cache entries

// Bad: includes non-deterministic data
getKey: () => `product:${Date.now()}` // Never hits cache
```

---

## Multi-Layer Cache Module

### Complete module for provider-aware cache configuration

```ts
// modules/cache.ts
import process from 'node:process'
import { defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'

const FETCH_CACHE_STORAGE_BASE = 'fetch-cache'

export default defineNuxtModule({
  meta: { name: 'cache-config' },
  setup(_, nuxt) {
    if (provider !== 'vercel') return

    nuxt.hook('nitro:config', nitroConfig => {
      nitroConfig.storage = nitroConfig.storage || {}

      // Main cache (defineCachedFunction, defineCachedEventHandler)
      nitroConfig.storage.cache = {
        ...nitroConfig.storage.cache,
        driver: 'vercel-runtime-cache',
      }

      // Fetch cache (custom SWR plugin)
      nitroConfig.storage[FETCH_CACHE_STORAGE_BASE] = {
        ...nitroConfig.storage[FETCH_CACHE_STORAGE_BASE],
        driver: 'vercel-runtime-cache',
      }

      // Session storage (persistent)
      const env = process.env.VERCEL_ENV
      nitroConfig.storage.sessions = {
        driver: env === 'production' ? 'vercel-kv' : 'vercel-runtime-cache',
      }
    })
  },
})
```

### Cache layer overview

| Layer                    | Backend       | TTL        | Use Case               |
| ------------------------ | ------------- | ---------- | ---------------------- |
| ISR                      | CDN edge      | 60s        | Page responses         |
| defineCachedEventHandler | Nitro storage | 5-60min    | API responses          |
| defineCachedFunction     | Nitro storage | 5min-24h   | Shared utility results |
| Fetch cache plugin       | Nitro storage | 5min       | External API calls     |
| Sessions                 | KV/Redis      | Persistent | User sessions          |
