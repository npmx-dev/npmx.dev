# Error Handling & Validation Patterns Reference

## Table of Contents

- [Centralized Error Handler](#centralized-error-handler)
- [Valibot Schema Patterns](#valibot-schema-patterns)
- [Route Validation Pattern](#route-validation-pattern)
- [mapWithConcurrency Utility](#mapwithconcurrency-utility)
- [Cache-Control Header Patterns](#cache-control-header-patterns)

---

## Centralized Error Handler

### Implementation

```ts
// server/utils/error-handler.ts
import { isError, createError } from 'h3'
import * as v from 'valibot'

interface ErrorOptions {
  statusCode?: number
  statusMessage?: string
  message?: string
}

export function handleApiError(error: unknown, fallback: ErrorOptions): never {
  // 1. Re-throw H3 errors (already well-formed)
  if (isError(error)) {
    // Override generic 500 with more specific status
    if (error.statusCode === 500 && fallback.statusCode) {
      error.statusCode = fallback.statusCode
    }
    if (error.statusMessage === 'Server Error' && fallback.statusMessage) {
      error.statusMessage = fallback.statusMessage
    }
    throw error
  }

  // 2. Convert Valibot validation errors to HTTP errors
  if (v.isValiError(error)) {
    throw createError({
      statusCode: 404, // or 400 - cacheable status codes preferred
      message: error.issues[0].message,
    })
  }

  // 3. Generic fallback for unknown errors
  throw createError({
    statusCode: fallback.statusCode ?? 502,
    statusMessage: fallback.statusMessage,
    message: fallback.message,
  })
}
```

### Usage in API routes

```ts
// server/api/products/[id].get.ts
export default defineCachedEventHandler(
  async (event) => {
    const rawId = getRouterParam(event, 'id') ?? ''

    try {
      const { id } = v.parse(ProductIdSchema, { id: rawId })
      const product = await $fetch(`https://api.example.com/products/${id}`)
      return product
    } catch (error) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to fetch product',
      })
    }
  },
  { maxAge: 300, swr: true, getKey: /* ... */ },
)
```

---

## Valibot Schema Patterns

### Package/resource name validation

```ts
// shared/schemas/package.ts
import * as v from 'valibot'
import validateNpmPackageName from 'validate-npm-package-name'

export const PackageNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Package name is required'),
  v.check(input => {
    const result = validateNpmPackageName(input)
    return result.validForNewPackages || result.validForOldPackages
  }, 'Invalid package name format'),
)
```

### Version validation (prevents directory traversal)

```ts
export const VersionSchema = v.pipe(
  v.string(),
  v.nonEmpty('Version is required'),
  v.regex(/^[\w.+-]+$/, 'Invalid version format'),
)
```

### File path validation (prevents directory traversal)

```ts
export const FilePathSchema = v.pipe(
  v.string(),
  v.nonEmpty('File path is required'),
  v.check(input => !input.includes('..'), 'Directory traversal not allowed'),
  v.check(input => !input.startsWith('/'), 'Must be relative'),
)
```

### Search query validation (prevents DoS)

```ts
export const SearchQuerySchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(100, 'Search query is too long'),
)
```

### Composite schemas with type inference

```ts
export const PackageRouteParamsSchema = v.object({
  packageName: PackageNameSchema,
  version: v.optional(VersionSchema),
})

// Types are inferred - no manual interface needed
export type PackageRouteParams = v.InferOutput<typeof PackageRouteParamsSchema>
// { packageName: string; version?: string }
```

### Query parameter validation with safeParse

```ts
const QUERY_SCHEMA = v.object({
  color: v.optional(v.string()),
  label: v.optional(v.string()),
  style: v.optional(v.picklist(['flat', 'plastic'])),
})

// safeParse doesn't throw - returns success/failure
const queryParams = v.safeParse(QUERY_SCHEMA, getQuery(event))
const color = queryParams.success ? queryParams.output.color : undefined
```

---

## Route Validation Pattern

### Parsing path segments into validated params

API routes often receive package names split across path segments (e.g., `@scope/name/v/1.0.0`). Parse them before validation:

```ts
// server/api/registry/analysis/[...pkg].get.ts
export default defineCachedEventHandler(
  async (event) => {
    const segments = getRouterParam(event, 'pkg')?.split('/') ?? []

    // Parse: ["@scope", "name", "v", "1.0.0"] -> { name: "@scope/name", version: "1.0.0" }
    const { rawPackageName, rawVersion } = parsePackageParams(segments)

    try {
      const { packageName, version } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
        version: rawVersion,
      })

      // Now packageName and version are validated and typed
      const data = await fetchData(packageName, version)
      return data
    } catch (error) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to analyze package',
      })
    }
  },
  { maxAge: 86400, swr: true, getKey: /* ... */ },
)
```

---

## mapWithConcurrency Utility

### Implementation

```ts
// shared/utils/async.ts
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 10,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length }) as R[]
  let currentIndex = 0

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++
      results[index] = await fn(items[index]!, index)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)

  return results
}
```

### Usage

```ts
// Fetch 50 packages with max 10 concurrent requests
const packuments = await mapWithConcurrency(
  packageNames,
  async name => {
    try {
      const encoded = encodePackageName(name)
      const { data } = await cachedFetch<Packument>(`https://registry.npmjs.org/${encoded}`, {
        signal,
      })
      return data
    } catch {
      return null // Don't fail the whole batch
    }
  },
  10,
)

// Filter out failures
const validPackuments = packuments.filter((p): p is Packument => p !== null)
```

### Design: worker pool pattern

Unlike `Promise.all(items.map(fn))` which starts all items immediately, `mapWithConcurrency` creates N workers that pull items from a shared queue. This ensures exactly N items are in-flight at any time.

---

## Cache-Control Header Patterns

### Redirect caching

```ts
// Cache redirects at CDN level
const cacheControl = 's-maxage=3600, stale-while-revalidate=36000'
setHeader(event, 'cache-control', cacheControl)
return sendRedirect(event, canonicalUrl, 301)
```

### API response caching

```ts
// Badge/image responses
setHeader(event, 'Content-Type', 'image/svg+xml')
setHeader(event, 'Cache-Control', `public, max-age=3600, s-maxage=3600`)
```

### Common patterns

| Scenario       | Header                                        |
| -------------- | --------------------------------------------- |
| Static asset   | `public, max-age=31536000, immutable`         |
| API response   | `public, max-age=60, s-maxage=300`            |
| Redirect       | `s-maxage=3600, stale-while-revalidate=36000` |
| Never cache    | `no-store, no-cache`                          |
| Private (auth) | `private, no-store`                           |
