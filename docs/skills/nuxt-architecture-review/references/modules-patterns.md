# Custom Nuxt Modules Reference

## Table of Contents

- [Module Design Principles](#module-design-principles)
- [Build Info Module](#build-info-module)
- [Cache Configuration Module](#cache-configuration-module)
- [ISR Fallback Module](#isr-fallback-module)
- [Component Extension Module](#component-extension-module)
- [shared/ Directory Structure](#shared-directory-structure)

---

## Module Design Principles

1. **Single responsibility** -- One module per concern (cache, build info, ISR fallback)
2. **Environment guards** -- Use `provider` from `std-env` to skip non-relevant environments
3. **Type augmentation** -- Extend Nuxt's type system via `declare module` for type-safe `appConfig`
4. **Hook-based** -- Use Nuxt/Nitro hooks instead of modifying config directly

### Module skeleton

```ts
// modules/my-feature.ts
import { defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'

export default defineNuxtModule({
  meta: { name: 'my-feature' },
  setup(_, nuxt) {
    // Environment guard
    if (provider !== 'vercel') return

    // Use hooks to modify behavior
    nuxt.hook('nitro:config', nitroConfig => {
      // Modify nitro config
    })
  },
})
```

---

## Build Info Module

Inject build metadata (version, commit, branch, environment) into `appConfig` for runtime access:

```ts
// modules/build-env.ts
import type { BuildInfo } from '../shared/types'
import { createResolver, defineNuxtModule } from 'nuxt/kit'
import { isCI } from 'std-env'
import { getEnv, version } from '../config/env'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtModule({
  meta: { name: 'build-env' },
  async setup(_, nuxt) {
    const { env, commit, shortCommit, branch } = await getEnv(nuxt.options.dev)

    nuxt.options.appConfig = nuxt.options.appConfig || {}
    nuxt.options.appConfig.buildInfo = {
      version,
      time: +Date.now(),
      commit,
      shortCommit,
      branch,
      env,
    } satisfies BuildInfo

    // Environment-specific public assets
    nuxt.options.nitro.publicAssets = nuxt.options.nitro.publicAssets || []
    if (env === 'dev') {
      nuxt.options.nitro.publicAssets.unshift({ dir: resolve('../public-dev') })
    } else if (env === 'staging') {
      nuxt.options.nitro.publicAssets.unshift({ dir: resolve('../public-staging') })
    }
  },
})

// Type augmentation for appConfig
declare module '@nuxt/schema' {
  interface AppConfig {
    buildInfo: BuildInfo
  }
}
```

### Usage in app

```ts
// In any component or composable
const { buildInfo } = useAppConfig()
console.log(buildInfo.version, buildInfo.commit)
```

---

## Cache Configuration Module

Configure Nitro storage backends per deployment provider:

```ts
// modules/cache.ts
import process from 'node:process'
import { defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'

export default defineNuxtModule({
  meta: { name: 'cache-config' },
  setup(_, nuxt) {
    if (provider !== 'vercel') return

    nuxt.hook('nitro:config', nitroConfig => {
      nitroConfig.storage = nitroConfig.storage || {}

      // SSR cache -> Vercel runtime cache
      nitroConfig.storage.cache = {
        ...nitroConfig.storage.cache,
        driver: 'vercel-runtime-cache',
      }

      // Fetch cache -> Vercel runtime cache
      nitroConfig.storage['fetch-cache'] = {
        driver: 'vercel-runtime-cache',
      }

      // Sessions -> KV in production, runtime cache in preview
      const env = process.env.VERCEL_ENV
      nitroConfig.storage.sessions = {
        driver: env === 'production' ? 'vercel-kv' : 'vercel-runtime-cache',
      }
    })
  },
})
```

---

## ISR Fallback Module

Generate SPA fallback HTML for ISR routes:

```ts
// modules/isr-fallback.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'

export default defineNuxtModule({
  meta: { name: 'isr-fallback' },
  setup(_, nuxt) {
    if (provider !== 'vercel') return

    nuxt.hook('nitro:init', nitro => {
      nitro.hooks.hook('compiled', () => {
        const spaTemplate = readFileSync(nitro.options.output.publicDir + '/200.html', 'utf-8')
        // Copy SPA shell to each dynamic route directory
        const routes = ['product', 'product/[id]', 'product/[id]/v/[version]']
        for (const path of routes) {
          const dir = resolve(nitro.options.output.serverDir, '..', path)
          mkdirSync(dir, { recursive: true })
          writeFileSync(resolve(dir, 'spa.prerender-fallback.html'), spaTemplate)
        }
      })
    })
  },
})
```

---

## Component Extension Module

Remove or modify auto-discovered components via hooks:

```ts
// modules/og-image.ts
import { defineNuxtModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'og-image-tweaks' },
  setup() {
    const nuxt = useNuxt()

    nuxt.hook('components:extend', components => {
      // Remove conflicting OG image components
      for (const component of [...components].toReversed()) {
        if (component.filePath.includes('og-image')) {
          components.splice(components.indexOf(component), 1)
        }
      }
    })
  },
})
```

---

## shared/ Directory Structure

### Recommended layout

```
shared/
  types/
    index.ts              # Re-exports all types
    product.ts            # Domain types
    api-responses.ts      # API response shapes
    user.ts               # User/session types
  schemas/
    product.ts            # Valibot schemas + inferred types
    auth.ts               # Auth validation schemas
  utils/
    constants.ts          # Shared constants (API URLs, cache durations)
    formatters.ts         # Pure formatting functions
    npm.ts                # Domain-specific pure utilities
    async.ts              # Async utilities (mapWithConcurrency)
    fetch-cache-config.ts # Cache config shared between plugin and composable
```

### Import examples

```ts
// From app/ code
import type { Product } from '#shared/types'
import { PackageNameSchema } from '#shared/schemas/product'
import { mapWithConcurrency } from '#shared/utils/async'

// From server/ code
import type { Product } from '#shared/types'
import { PackageNameSchema } from '#shared/schemas/product'
```

### What belongs in shared/

| Content                     | Belongs in `shared/`? | Why                                         |
| --------------------------- | --------------------- | ------------------------------------------- |
| Type definitions            | Yes                   | Used by both app and server                 |
| Valibot schemas             | Yes                   | Validation in server, type inference in app |
| Pure utility functions      | Yes                   | No side effects, works everywhere           |
| Constants (URLs, durations) | Yes                   | Referenced by both sides                    |
| Vue composables             | No                    | Client/SSR only, use `app/composables/`     |
| Server utilities            | No                    | Nitro-only, use `server/utils/`             |
| Database clients            | No                    | Server-only                                 |
