# ISR Patterns Reference

## Table of Contents

- [Route Rules Strategy](#route-rules-strategy)
- [ISR Helper Function](#isr-helper-function)
- [SPA Fallback Module](#spa-fallback-module)
- [Query-Aware ISR](#query-aware-isr)
- [Immutable Content Caching](#immutable-content-caching)

---

## Route Rules Strategy

Categorize every route into one of these tiers:

| Tier            | Config                                   | Use Case                           |
| --------------- | ---------------------------------------- | ---------------------------------- |
| Static          | `prerender: true`                        | Homepage, about, privacy, settings |
| Dynamic + fresh | `isr: { expiration: 60 }`                | Product pages, profiles            |
| Immutable       | `isr: true, cache: { maxAge: 31536000 }` | Versioned content (docs, code)     |
| Never cache     | `isr: false, cache: false`               | Auth, search, real-time data       |
| Proxy           | `proxy: 'https://...'`                   | Analytics, avatars                 |

Full example from a production app:

```ts
// nuxt.config.ts
routeRules: {
  // API routes - default 60s revalidation
  '/api/**': { isr: 60 },
  // Immutable API responses (versioned - content never changes)
  '/api/registry/docs/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
  '/api/registry/file/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },

  // Never cache auth or social endpoints
  '/api/auth/**': { isr: false, cache: false },
  '/api/social/**': { isr: false, cache: false },

  // Query-aware ISR (search suggestions)
  '/api/opensearch/suggestions': {
    isr: {
      expiration: 60 * 60 * 24,
      passQuery: true,
      allowQuery: ['q'],
    },
  },

  // Dynamic pages with SPA fallback
  '/package/:name': { isr: getISRConfig(60, true) },
  '/package/:org/:name': { isr: getISRConfig(60, true) },

  // Immutable versioned pages
  '/package-code/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },

  // Static pages
  '/': { prerender: true },
  '/about': { prerender: true },
  '/settings': { prerender: true },

  // Never cache search
  '/search': { isr: false, cache: false },
}
```

---

## ISR Helper Function

Use a helper to standardize ISR config and optionally add SPA fallback for dynamic routes:

```ts
// At the bottom of nuxt.config.ts (or in a shared config file)
function getISRConfig(expirationSeconds: number, fallback = false) {
  if (fallback) {
    return {
      expiration: expirationSeconds,
      fallback: 'spa.prerender-fallback.html',
    } as { expiration: number }
  }
  return { expiration: expirationSeconds }
}
```

The `fallback` option tells the hosting platform (e.g., Vercel) to serve an SPA shell while the ISR page is being generated for the first time. This prevents users from seeing a loading spinner or error on uncached pages.

---

## SPA Fallback Module

Generate SPA fallback HTML files for each dynamic route pattern. This Nuxt module copies the prerendered `200.html` SPA shell to every dynamic route directory at build time:

```ts
// modules/isr-fallback.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'

export default defineNuxtModule({
  meta: { name: 'isr-fallback' },
  setup(_, nuxt) {
    // Only run on Vercel
    if (provider !== 'vercel') return

    nuxt.hook('nitro:init', nitro => {
      nitro.hooks.hook('compiled', () => {
        const spaTemplate = readFileSync(nitro.options.output.publicDir + '/200.html', 'utf-8')
        // Generate fallback for every dynamic route pattern
        for (const path of [
          'package',
          'package/[name]',
          'package/[name]/v/[version]',
          'package/[org]/[name]',
          '',
        ]) {
          const outputPath = resolve(
            nitro.options.output.serverDir,
            '..',
            path,
            'spa.prerender-fallback.html',
          )
          mkdirSync(resolve(nitro.options.output.serverDir, '..', path), {
            recursive: true,
          })
          writeFileSync(outputPath, spaTemplate)
        }
      })
    })
  },
})
```

---

## Query-Aware ISR

For routes that vary by query string (e.g., search suggestions), use `passQuery` and `allowQuery`:

```ts
'/api/search/suggestions': {
  isr: {
    expiration: 86400,   // 1 day
    passQuery: true,     // include query in cache key
    allowQuery: ['q'],   // only 'q' param affects the cache key
  },
}
```

Without `passQuery`, all query variations return the same cached response. Without `allowQuery`, tracking params like `utm_source` bust the cache.

---

## Immutable Content Caching

For content that never changes once published (e.g., versioned package docs, specific file at a version), use `isr: true` with a long `maxAge`:

```ts
// Versioned content - cache for 1 year
'/docs/v/:version/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
```

`isr: true` (without expiration) means: generate once, cache forever, never revalidate. Combined with `maxAge`, the CDN also caches it for the specified duration.
