# TypeScript Patterns Reference

## Table of Contents

- [Discriminated Unions](#discriminated-unions)
- [satisfies Operator](#satisfies-operator)
- [Schema-Driven Types](#schema-driven-types)
- [Type Augmentation](#type-augmentation)

---

## Discriminated Unions

### Pattern: status modeling

Instead of an object with optional fields, use a `kind` discriminant:

```ts
// Bad: optional fields, easy to misuse
interface LoadingState {
  isLoading: boolean
  data?: Product
  error?: Error
}

// Good: discriminated union, impossible states are unrepresentable
type LoadingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Product }
  | { status: 'error'; error: Error }
```

### Pattern: feature detection

```ts
type TypesStatus =
  | { kind: 'included' }
  | { kind: '@types'; packageName: string; deprecated?: string }
  | { kind: 'none' }

function detectTypesStatus(pkg: PackageJson): TypesStatus {
  if (pkg.types || pkg.typings) return { kind: 'included' }
  const typesPackage = findTypesPackage(pkg.name)
  if (typesPackage) return { kind: '@types', packageName: typesPackage.name }
  return { kind: 'none' }
}

// Usage: TypeScript narrows automatically
function renderBadge(status: TypesStatus): string {
  switch (status.kind) {
    case 'included':
      return 'TS'
    case '@types':
      return `@types/${status.packageName}`
    case 'none':
      return 'No types'
  }
  // TypeScript error if a case is missing (exhaustiveness check)
}
```

### Pattern: API response variants

```ts
type ApiResponse<T> =
  | { ok: true; data: T; isStale: boolean }
  | { ok: false; error: string; statusCode: number }

function handleResponse<T>(response: ApiResponse<T>) {
  if (response.ok) {
    // TypeScript knows: response.data exists, response.error doesn't
    console.log(response.data)
  } else {
    // TypeScript knows: response.error exists, response.data doesn't
    console.error(response.error)
  }
}
```

---

## satisfies Operator

### Pattern: type-checked return values

```ts
// Bad: 'as' suppresses errors and widens the type
return {
  package: name,
  version: pkg.version,
} as PackageResponse // Typo in field name? No error!

// Good: 'satisfies' catches errors while preserving literal types
return {
  package: name,
  version: pkg.version,
} satisfies PackageResponse // Error if shape doesn't match
```

### Pattern: typed defaults

```ts
// The type is checked but the literal values are preserved
const emptyResponse = {
  objects: [],
  total: 0,
  isStale: false,
  time: new Date().toISOString(),
} satisfies SearchResponse

// emptyResponse.total is typed as 0 (literal), not number
```

### Pattern: config objects

```ts
// Ensures the config matches the expected shape
const theme = {
  spacing: { DEFAULT: '4px' },
  font: {
    mono: "'Geist Mono', monospace",
    sans: "'Geist', system-ui, sans-serif",
  },
} satisfies ThemeConfig
```

### When to use satisfies vs as vs annotation

| Approach         | Use when                                                        |
| ---------------- | --------------------------------------------------------------- |
| `satisfies Type` | Checking shape without widening (return values, defaults)       |
| `: Type`         | Variable declarations where you want the wider type             |
| `as Type`        | Narrowing in assertions you're certain about (avoid on returns) |

---

## Schema-Driven Types

### Pattern: infer types from Valibot schemas

```ts
import * as v from 'valibot'

// Define the schema once
export const ProductSchema = v.object({
  id: v.pipe(v.string(), v.nonEmpty()),
  name: v.pipe(v.string(), v.minLength(1)),
  version: v.optional(v.pipe(v.string(), v.regex(/^[\w.+-]+$/))),
  tags: v.array(v.string()),
})

// Infer the type from the schema - no manual interface needed
export type Product = v.InferOutput<typeof ProductSchema>
// { id: string; name: string; version?: string; tags: string[] }

// Use in routes
const product = v.parse(ProductSchema, rawInput)
// product is fully typed as Product
```

### Why this is better than manual types

1. **Single source of truth** -- Schema and type are always in sync
2. **Runtime validation** -- The schema validates at runtime, not just compile time
3. **Auto-complete** -- IDE knows the shape from the schema
4. **Refactor-safe** -- Change the schema, the type updates automatically

### Pattern: multiple schemas sharing fields

```ts
const BaseProductSchema = v.object({
  name: PackageNameSchema, // Reuse validated fields
})

const ProductWithVersionSchema = v.object({
  ...BaseProductSchema.entries,
  version: VersionSchema,
})

const ProductWithFileSchema = v.object({
  ...ProductWithVersionSchema.entries,
  filePath: FilePathSchema,
})

// Each infers its own type
type ProductRoute = v.InferOutput<typeof BaseProductSchema>
type ProductVersionRoute = v.InferOutput<typeof ProductWithVersionSchema>
type ProductFileRoute = v.InferOutput<typeof ProductWithFileSchema>
```

---

## Type Augmentation

### Pattern: extend Nuxt's AppConfig

```ts
// modules/build-env.ts
declare module '@nuxt/schema' {
  interface AppConfig {
    env: 'dev' | 'staging' | 'production'
    buildInfo: BuildInfo
  }
}
```

Now `useAppConfig().buildInfo` is fully typed.

### Pattern: extend H3 event context

```ts
// server/plugins/fetch-cache.ts
declare module 'h3' {
  interface H3EventContext {
    cachedFetch?: CachedFetchFunction
  }
}
```

Now `event.context.cachedFetch` is fully typed across all server code.

### Pattern: extend component props globally

```ts
// types/global.d.ts
declare module 'vue' {
  interface ComponentCustomProperties {
    $formatDate: (date: string) => string
  }
}
```
