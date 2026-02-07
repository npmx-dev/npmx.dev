---
name: nuxt-architecture-review
description: >
  Review and audit a Nuxt application for architecture quality, code organization, and TypeScript
  best practices. Use when asked to "review code quality", "audit architecture", "improve project
  structure", "review TypeScript patterns", "check component design", "audit code organization",
  or any structural/quality review on a Nuxt 3/4 project. Covers custom modules, shared/ directory,
  composable organization, TypeScript patterns (discriminated unions, satisfies, schema inference),
  server/client component split, route aliases, canonical redirects, defineModel, and security
  patterns.
---

# Nuxt Architecture & Code Quality Review

Audit a Nuxt application for architecture quality, project structure, TypeScript patterns, and component design. Scan the codebase for each pattern below, explain the concept, and propose fixes.

For full code examples, see the `references/` files linked in each section.

## Review Process

1. Read project structure (`app/`, `server/`, `shared/`, `modules/`)
2. Check `modules/` for custom Nuxt modules
3. Scan composables for organization and patterns
4. Review TypeScript usage across `shared/` and `server/`
5. Check component architecture in `app/components/`
6. Review routing patterns and middleware
7. Report findings with explanations and suggested fixes

---

## 1. Custom Nuxt Modules for Cross-Cutting Concerns

**What:** Nuxt modules are the standard way to encapsulate cross-cutting concerns (cache configuration, build info, environment-specific behavior) that don't belong in `nuxt.config.ts` or in app code. Each module is a self-contained unit with a single responsibility.

**Why:** Putting all configuration in `nuxt.config.ts` leads to a massive, hard-to-maintain config file. Modules keep concerns separated, testable, and conditionally applied based on environment.

**What to look for:** Check `nuxt.config.ts` for complex logic that should be extracted. Look for environment-specific code scattered across the app. Check if a `modules/` directory exists.

**Good:**

```ts
// modules/cache.ts - single responsibility: cache configuration
export default defineNuxtModule({
  meta: { name: 'cache-config' },
  setup(_, nuxt) {
    if (provider !== 'vercel') return // Environment guard

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

**Bad:**

```ts
// nuxt.config.ts with 200+ lines of inline logic
export default defineNuxtConfig({
  hooks: {
    'nitro:config': nitroConfig => {
      // 50 lines of cache config
      // 30 lines of build info
      // 20 lines of ISR fallback
    },
  },
})
```

**Fix:** Extract cross-cutting concerns into `modules/`. One module per concern. Use `provider` guards from `std-env`. See [references/modules-patterns.md](references/modules-patterns.md).

---

## 2. shared/ Directory for Cross-Boundary Code

**What:** The `shared/` directory in Nuxt 4 contains types, schemas, and utilities shared between `app/` (client + SSR) and `server/` (Nitro). It's accessible via the `#shared` alias.

**Why:** Without a shared directory, types and utilities get duplicated between `app/` and `server/`, or server-only code leaks into the client bundle. The `shared/` directory provides a clean boundary.

**What to look for:** Check for duplicated types or utilities between `app/` and `server/`. Check if `server/` imports from `app/` (bad) or if types are defined inline in API routes.

**Good:**

```
shared/
  types/
    product.ts          # Shared between app and server
    api-responses.ts
  schemas/
    product.ts          # Valibot schemas used in both
  utils/
    formatters.ts       # Pure functions used everywhere
    constants.ts        # Shared constants
```

**Bad:**

```
app/types/product.ts      # Duplicated type definition
server/types/product.ts   # Same type, different file
```

**Fix:** Move shared types, schemas, and pure utilities to `shared/`. Import via `#shared/types/product` or `#shared/utils/formatters`. See [references/modules-patterns.md](references/modules-patterns.md).

---

## 3. Feature-Grouped Composables

**What:** Organize composables by domain/feature (e.g., `composables/npm/`, `composables/auth/`) rather than by type (e.g., all composables flat in `composables/`).

**Why:** A flat `composables/` directory with 30+ files becomes hard to navigate. Grouping by feature makes related composables discoverable and maintainable. The auto-import `dirs` config can handle nested directories.

**What to look for:** Count composables in `app/composables/`. If there are more than 10, check if they're grouped by feature.

**Good:**

```
app/composables/
  npm/
    useNpmSearch.ts
    usePackage.ts
    usePackageDownloads.ts
  auth/
    useAuth.ts
    useSession.ts
  useColors.ts             # Standalone utilities
  useMarkdown.ts
```

```ts
// nuxt.config.ts - auto-import nested composables
imports: {
  dirs: ['~/composables', '~/composables/*/*.ts'],
},
```

**Bad:**

```
app/composables/
  useNpmSearch.ts
  usePackage.ts
  usePackageDownloads.ts
  useAuth.ts
  useSession.ts
  useColors.ts
  useMarkdown.ts
  useVirtualScroll.ts
  ... 20 more files
```

**Fix:** Group related composables into subdirectories. Update `imports.dirs` in `nuxt.config.ts`.

---

## 4. TypeScript Discriminated Unions

**What:** Use a shared `kind` or `type` property to create exhaustive, type-safe status objects. TypeScript narrows the type automatically in `switch` statements and `if` checks.

**Why:** Discriminated unions make impossible states unrepresentable. Without them, you end up with optional properties and runtime checks that can be forgotten.

**What to look for:** Search for status/state objects with multiple optional properties. These often indicate a missing discriminated union.

**Good:**

```ts
type TypesStatus =
  | { kind: 'included' }
  | { kind: '@types'; packageName: string; deprecated?: string }
  | { kind: 'none' }

function renderTypesStatus(status: TypesStatus) {
  switch (status.kind) {
    case 'included':
      return 'Built-in types'
    case '@types':
      return `@types/${status.packageName}` // TS knows packageName exists
    case 'none':
      return 'No types'
  }
}
```

**Bad:**

```ts
interface TypesStatus {
  hasTypes: boolean
  typesPackage?: string
  deprecated?: string
}

// Easy to forget checks, no exhaustiveness guarantee
if (status.hasTypes) {
  /* ... */
} else if (status.typesPackage) {
  /* ... */
} // Could be undefined even when hasTypes is false
```

**Fix:** Refactor status objects to discriminated unions with a `kind` or `type` discriminant. See [references/typescript-patterns.md](references/typescript-patterns.md).

---

## 5. satisfies Operator

**What:** The `satisfies` operator checks that a value conforms to a type without widening it. Unlike `as`, it preserves the literal types and catches structural errors at compile time.

**Why:** Using `as` to type a return value suppresses errors and widens types. `satisfies` ensures correctness while preserving the exact shape for consumers.

**What to look for:** Search for `as` type assertions on return values and object literals. These are often better expressed with `satisfies`.

**Good:**

```ts
return {
  package: packageName,
  version: pkg.version ?? 'latest',
  ...analysis,
} satisfies PackageAnalysisResponse

const defaults = {
  objects: [],
  total: 0,
  time: new Date().toISOString(),
} satisfies NpmSearchResponse
```

**Bad:**

```ts
// 'as' suppresses errors and widens the type
return {
  package: packageName,
  version: pkg.version ?? 'latest',
  ...analysis,
} as PackageAnalysisResponse
```

**Fix:** Replace `as Type` with `satisfies Type` on return values and object literals. See [references/typescript-patterns.md](references/typescript-patterns.md).

---

## 6. Server/Client Component Split

**What:** Nuxt supports `.server.vue` and `.client.vue` suffixes. A `.server.vue` component only renders on the server (SSR HTML, no hydration JS). A `.client.vue` component only renders on the client (after hydration). When both exist with the same name, Nuxt uses the server version during SSR and swaps to the client version after hydration.

**Why:** Components that are only needed on the server (static UI, SEO content) should not ship JavaScript to the client. Components that need browser APIs (localStorage, window) should not run during SSR.

**What to look for:** Check for components with `onMounted` guards wrapping all logic, or components that are purely presentational with no interactivity. These are candidates for server/client split.

**Good:**

```
app/components/Header/
  AccountMenu.server.vue    # SSR: shows login button placeholder
  AccountMenu.client.vue    # Client: shows actual auth state with dropdown
```

**Bad:**

```vue
<!-- Single component with SSR guards everywhere -->
<script setup>
const isClient = ref(false)
onMounted(() => {
  isClient.value = true
})
</script>
<template>
  <div v-if="isClient"><!-- actual content --></div>
  <div v-else><!-- placeholder --></div>
</template>
```

**Fix:** Split into `.server.vue` and `.client.vue` files. See [references/component-patterns.md](references/component-patterns.md).

---

## 7. Route Aliases in definePageMeta

**What:** `definePageMeta` supports an `alias` property that maps multiple URL patterns to the same page component. This avoids duplicating page components for different URL shapes.

**Why:** Without aliases, you either duplicate page files or use complex redirects. Aliases keep one source of truth while supporting multiple URL patterns.

**What to look for:** Check for duplicated page components or complex redirect middleware that could be replaced with route aliases.

**Good:**

```ts
// app/pages/package-code/[...path].vue
definePageMeta({
  name: 'code',
  path: '/package-code/:path+',
  alias: ['/package/code/:path+', '/code/:path+'],
})
```

**Bad:**

```
app/pages/
  package-code/[...path].vue    # Original
  code/[...path].vue            # Duplicate component
  package/code/[...path].vue    # Another duplicate
```

**Fix:** Use `alias` in `definePageMeta` to support multiple URL patterns from a single page component. See [references/component-patterns.md](references/component-patterns.md).

---

## 8. Canonical Redirects Middleware

**What:** A server middleware that redirects legacy, shorthand, or non-canonical URLs to the canonical version with appropriate Cache-Control headers. Uses 301 (permanent) redirects.

**Why:** Multiple URLs pointing to the same content hurt SEO (duplicate content), confuse caching (different cache entries for the same data), and create inconsistent user experience.

**What to look for:** Check if the app has multiple URL patterns for the same content. Check for a canonical redirect middleware in `server/middleware/`.

**Good:**

```ts
// server/middleware/canonical-redirects.global.ts
const cacheControl = 's-maxage=3600, stale-while-revalidate=36000'

export default defineEventHandler(async event => {
  const [path] = event.path.split('?')

  // /vue -> /package/vue (301)
  const match = path.match(/^\/(?<name>[^/@]+)$/)
  if (match?.groups) {
    setHeader(event, 'cache-control', cacheControl)
    return sendRedirect(event, `/package/${match.groups.name}`, 301)
  }
})
```

**Fix:** Create a `server/middleware/canonical-redirects.global.ts` that maps shorthand URLs to canonical ones. See [references/component-patterns.md](references/component-patterns.md).

---

## 9. defineModel for v-model

**What:** `defineModel()` is the Vue 3.4+ macro for two-way binding. It replaces the `defineProps` + `defineEmits` + `computed` boilerplate for `v-model`.

**Why:** Reduces 10+ lines of boilerplate to a single line. Makes the component API clearer: "this prop supports v-model".

**What to look for:** Search for the old `modelValue` prop + `update:modelValue` emit pattern. Also check for named v-model props using the old pattern.

**Good:**

```ts
// Child component
const sortOption = defineModel<string>('sortOption', { required: true })
const pageSize = defineModel<number>('pageSize', { default: 25 })

// Parent: <MyComponent v-model:sort-option="sort" v-model:page-size="size" />
```

**Bad:**

```ts
const props = defineProps<{ sortOption: string; pageSize: number }>()
const emit = defineEmits<{
  'update:sortOption': [value: string]
  'update:pageSize': [value: number]
}>()
const localSort = computed({
  get: () => props.sortOption,
  set: v => emit('update:sortOption', v),
})
```

**Fix:** Replace `defineProps` + `defineEmits` + `computed` patterns with `defineModel()`. See [references/component-patterns.md](references/component-patterns.md).

---

## 10. XSS-Safe Markdown Rendering

**What:** When rendering user-provided markdown (package READMEs, descriptions), sanitize HTML, validate URL protocols, and use ReDoS-safe regex patterns.

**Why:** Rendering raw markdown without sanitization opens XSS vectors. Using unbounded regex on user input enables ReDoS attacks.

**What to look for:** Search for `v-html` usage. Check if the HTML source is sanitized. Check regex patterns for catastrophic backtracking.

**Good:**

```ts
// Escape HTML entities before parsing markdown
function sanitize(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Validate link protocols
html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
  try {
    const { protocol } = new URL(url)
    if (['https:', 'mailto:'].includes(protocol)) {
      return `<a href="${url}" rel="nofollow noreferrer noopener">${text}</a>`
    }
  } catch {}
  return `${text} (${url})` // Invalid URL: render as plain text
})

// ReDoS-safe: use bounded quantifiers instead of unbounded *
text.replace(/\[!\[[^\]]{0,500}\]\([^)]{0,2000}\)\]\([^)]{0,2000}\)?/g, '')
```

**Bad:**

```ts
// Raw HTML injection
v-html="userMarkdown"

// Unbounded regex - vulnerable to ReDoS
text.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
```

**Fix:** Sanitize HTML before rendering. Validate URL protocols. Use bounded quantifiers in regex. See [references/component-patterns.md](references/component-patterns.md).
