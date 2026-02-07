---
name: nuxt-server-review
description: >
  Review and audit a Nuxt application's server-side API routes, caching layers, and data fetching
  infrastructure. Use when asked to "review server code", "optimize API routes", "audit caching
  strategy", "improve server performance", "review error handling", "add validation", or any
  server-side code review on a Nuxt 3/4 project. Covers defineCachedEventHandler, SWR,
  defineCachedFunction, fetch-cache plugins, centralized error handling, Valibot validation,
  Cache-Control headers, and parallel data fetching with concurrency control.
---

# Nuxt Server & Caching Architecture Review

Audit a Nuxt application's server-side code for caching, validation, error handling, and data fetching patterns. Scan the codebase for each pattern below, explain the concept, and propose fixes.

For full code examples, see the `references/` files linked in each section.

## Review Process

1. Read `server/api/` for API route handlers and their caching configuration
2. Read `server/utils/` for shared server utilities and cached functions
3. Read `server/plugins/` for Nitro plugins (fetch cache, middleware)
4. Read `server/middleware/` for request processing
5. Check `shared/schemas/` for validation schemas
6. Report findings with explanations and suggested fixes

---

## 1. defineCachedEventHandler with SWR

**What:** `defineCachedEventHandler` wraps a Nitro event handler with automatic caching. Combined with `swr: true` (Stale-While-Revalidate), it serves cached responses instantly and revalidates in the background after the TTL expires. The `getKey` function determines the cache key.

**Why:** Without caching, every API request hits the full handler logic (database queries, external API calls). With SWR, the first request populates the cache, and subsequent requests are served in microseconds. After the TTL, the next request still gets the cached response instantly, while a background process fetches fresh data.

**What to look for:** Check `server/api/` routes. Are they wrapped in `defineCachedEventHandler`? Do they have `swr: true`? Is the `getKey` function producing unique, deterministic keys?

**Good:**

```ts
// server/api/products/[id].get.ts
export default defineCachedEventHandler(
  async event => {
    const id = getRouterParam(event, 'id')
    const product = await db.query('SELECT * FROM products WHERE id = ?', [id])
    return product
  },
  {
    maxAge: 300, // 5 minutes
    swr: true, // serve stale while revalidating
    getKey: event => {
      const id = getRouterParam(event, 'id') ?? ''
      return `product:v1:${id}`
    },
  },
)
```

**Bad:**

```ts
// No caching - every request hits the database
export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'id')
  return await db.query('SELECT * FROM products WHERE id = ?', [id])
})
```

**Fix:** Wrap with `defineCachedEventHandler`, set `swr: true`, and define a stable `getKey`. Version the cache key (e.g., `v1:`) to invalidate on format changes. See [references/cached-handlers.md](references/cached-handlers.md).

---

## 2. defineCachedFunction for Reusable Cached Logic

**What:** `defineCachedFunction` caches the result of any async function independently from HTTP handlers. This is useful for shared server utilities called from multiple routes.

**Why:** If multiple API routes call the same external API (e.g., fetching package metadata), each route would make a redundant request. `defineCachedFunction` ensures one fetch populates a cache shared across all callers.

**What to look for:** Check `server/utils/` for functions that call external APIs or perform expensive computations. Are they wrapped in `defineCachedFunction`?

**Good:**

```ts
// server/utils/products.ts
export const fetchProduct = defineCachedFunction(
  async (id: string): Promise<Product> => {
    return await $fetch(`https://api.example.com/products/${id}`)
  },
  {
    maxAge: 300,
    swr: true,
    name: 'product',
    getKey: (id: string) => id,
  },
)
```

**Bad:**

```ts
// Called from 3 different routes, each making a separate API call
export async function fetchProduct(id: string) {
  return await $fetch(`https://api.example.com/products/${id}`)
}
```

**Fix:** Wrap with `defineCachedFunction`. Use `name` for cache namespace and `getKey` for unique keys. See [references/cached-handlers.md](references/cached-handlers.md).

---

## 3. Custom SWR Fetch-Cache Plugin

**What:** A Nitro plugin that intercepts outgoing `$fetch` calls during SSR and caches their responses with SWR semantics. It attaches a `cachedFetch` function to `event.context`, which composables can access via `useRequestEvent()`. Background revalidation uses `event.waitUntil()` for serverless compatibility.

**Why:** Even with `defineCachedEventHandler`, the handler's internal `$fetch` calls to external APIs are not cached. A fetch-cache plugin adds a second layer: the handler is cached, AND the external API calls within it are cached independently.

**What to look for:** Check if the app makes external API calls during SSR. Is there a fetch-caching layer? Does it use `event.waitUntil()` for background work?

**Good:** A dedicated Nitro plugin with domain allowlisting and SWR semantics. See [references/swr-fetch-cache.md](references/swr-fetch-cache.md) for the complete implementation.

**Fix:** Create a `server/plugins/fetch-cache.ts` Nitro plugin and a `useCachedFetch()` composable bridge. See [references/swr-fetch-cache.md](references/swr-fetch-cache.md).

---

## 4. Centralized Error Handling

**What:** A single `handleApiError()` utility that normalizes all error types (H3 errors, Valibot validation errors, generic exceptions) into consistent HTTP error responses.

**Why:** Without centralized error handling, each route has its own try/catch with inconsistent status codes and messages. A 500 from a validation error is wrong (should be 400/404). Inconsistent error formats break frontend error handling.

**What to look for:** Check `server/api/` routes for error handling patterns. Are they consistent? Do validation errors return appropriate status codes?

**Good:**

```ts
// server/utils/error-handler.ts
export function handleApiError(error: unknown, fallback: ErrorOptions): never {
  // Re-throw H3 errors with fallback status if generic 500
  if (isError(error)) {
    if (error.statusCode === 500 && fallback.statusCode) {
      error.statusCode = fallback.statusCode
    }
    throw error
  }

  // Validation errors -> 400/404
  if (v.isValiError(error)) {
    throw createError({
      statusCode: 404,
      message: error.issues[0].message,
    })
  }

  // Generic fallback
  throw createError({
    statusCode: fallback.statusCode ?? 502,
    message: fallback.message,
  })
}

// Usage in routes:
try {
  const params = v.parse(Schema, rawInput)
  // ... handler logic
} catch (error) {
  handleApiError(error, {
    statusCode: 502,
    message: 'Failed to fetch product data',
  })
}
```

**Bad:**

```ts
// Inconsistent error handling in every route
try {
  // ...
} catch (e) {
  throw createError({ statusCode: 500, message: 'Something went wrong' })
}
```

**Fix:** Create a `handleApiError` utility in `server/utils/` and use it in all API routes. See [references/error-validation-patterns.md](references/error-validation-patterns.md).

---

## 5. Valibot Schema Validation

**What:** Validate all route parameters, query strings, and request bodies using Valibot schemas. Types are inferred from schemas, eliminating manual type definitions.

**Why:** Without validation, invalid input causes cryptic 500 errors deep in the handler. Valibot catches bad input early with clear error messages and provides TypeScript types for free via `v.InferOutput`.

**What to look for:** Check API routes for parameter validation. Are route params, query strings, and bodies validated? Are types inferred or manually defined?

**Good:**

```ts
// shared/schemas/product.ts
export const ProductIdSchema = v.pipe(
  v.string(),
  v.nonEmpty('Product ID is required'),
  v.regex(/^[a-z0-9-]+$/, 'Invalid product ID format'),
)

export const ProductRouteSchema = v.object({
  id: ProductIdSchema,
  version: v.optional(v.pipe(v.string(), v.regex(/^[\w.+-]+$/))),
})

// Type inferred from schema - no manual interface needed
export type ProductRouteParams = v.InferOutput<typeof ProductRouteSchema>

// Usage in route:
const params = v.parse(ProductRouteSchema, { id: rawId, version: rawVersion })
// params is fully typed as { id: string; version?: string }
```

**Bad:**

```ts
// No validation - trusts user input
const id = getRouterParam(event, 'id')! // could be anything
const product = await db.query(`SELECT * FROM products WHERE id = '${id}'`)
```

**Fix:** Create schemas in `shared/schemas/`, validate in routes, infer types. See [references/error-validation-patterns.md](references/error-validation-patterns.md).

---

## 6. Cache-Control Headers

**What:** Set explicit `Cache-Control` headers on responses for CDN caching. Use `s-maxage` (CDN cache duration) and `stale-while-revalidate` (how long stale content can be served while revalidating).

**Why:** Even with ISR, explicit Cache-Control headers give you fine-grained control over CDN behavior. They work with any CDN (not just Vercel) and control how long redirects, static responses, and API responses are cached at the edge.

**What to look for:** Check server middleware and API routes for `setHeader(event, 'Cache-Control', ...)` calls. Are redirects cached? Are API responses tagged with appropriate cache headers?

**Good:**

```ts
// Cache redirects for 1 hour, serve stale for 10 hours
const cacheControl = 's-maxage=3600, stale-while-revalidate=36000'
setHeader(event, 'cache-control', cacheControl)
return sendRedirect(event, newUrl, 301)
```

**Bad:**

```ts
// No cache headers - CDN must re-request on every hit
return sendRedirect(event, newUrl, 301)
```

**Fix:** Add `Cache-Control` headers to redirects, API responses, and static assets.

---

## 7. Parallel Fetching with Concurrency Control

**What:** Use `Promise.all` for independent API calls and a `mapWithConcurrency` utility for bulk operations that need a concurrency limit to avoid overwhelming external APIs.

**Why:** Sequential API calls are slow. If you need to fetch 50 packages, doing them one-by-one takes 50x longer than parallel. But unlimited `Promise.all` on 500 items can hit rate limits or exhaust connections. `mapWithConcurrency` balances speed and safety.

**What to look for:** Check server utils and API routes for sequential `await` loops. Are independent fetches parallelized? Is there concurrency control for bulk operations?

**Good:**

```ts
// Independent fetches in parallel
const [product, reviews, related] = await Promise.all([
  fetchProduct(id),
  fetchReviews(id),
  fetchRelated(id),
])

// Bulk operations with concurrency limit
const results = await mapWithConcurrency(
  packageNames,
  async name => fetchPackageData(name),
  10, // max 10 concurrent requests
)
```

**Bad:**

```ts
// Sequential - 3x slower
const product = await fetchProduct(id)
const reviews = await fetchReviews(id)
const related = await fetchRelated(id)

// Unlimited parallelism - may hit rate limits
const results = await Promise.all(
  packageNames.map(name => fetchPackageData(name)), // 500 concurrent requests!
)
```

**Fix:** Use `Promise.all` for independent fetches. Create a `mapWithConcurrency` utility for bulk operations. See [references/error-validation-patterns.md](references/error-validation-patterns.md).

---

## 8. Multi-Layer Cache Architecture

**What:** Use different storage backends for different cache types: runtime cache for SSR responses, KV/Redis for sessions, local storage for development. Configure via a custom Nuxt module that sets up Nitro storage based on the deployment provider.

**Why:** One cache backend doesn't fit all needs. Runtime cache is fast but ephemeral. KV/Redis is persistent but slower. Local filesystem works for development. A module-based approach keeps this configuration clean and provider-aware.

**What to look for:** Check for a cache configuration module. Is storage configured differently per environment? Are there fallbacks for local development?

**Good:**

```ts
// modules/cache.ts
export default defineNuxtModule({
  meta: { name: 'cache-config' },
  setup(_, nuxt) {
    if (provider !== 'vercel') return

    nuxt.hook('nitro:config', nitroConfig => {
      nitroConfig.storage = nitroConfig.storage || {}
      nitroConfig.storage.cache = {
        ...nitroConfig.storage.cache,
        driver: 'vercel-runtime-cache',
      }
    })
  },
})
```

**Fix:** Create a `modules/cache.ts` module that configures storage per provider. See [references/cached-handlers.md](references/cached-handlers.md).
