import { defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'

// Storage key for fetch cache - must match shared/utils/fetch-cache-config.ts
const FETCH_CACHE_STORAGE_BASE = 'fetch-cache'

export default defineNuxtModule({
  meta: {
    name: 'vercel-cache',
  },
  setup(_, nuxt) {
    if (provider !== 'vercel') {
      return
    }

    nuxt.hook('nitro:config', nitroConfig => {
      nitroConfig.storage = nitroConfig.storage || {}

      // Main cache storage (for defineCachedFunction, etc.)
      nitroConfig.storage.cache = {
        ...nitroConfig.storage.cache,
        driver: 'vercel-runtime-cache',
      }

      // Fetch cache storage (for SWR fetch caching)
      nitroConfig.storage[FETCH_CACHE_STORAGE_BASE] = {
        ...nitroConfig.storage[FETCH_CACHE_STORAGE_BASE],
        driver: 'vercel-runtime-cache',
      }

      const env = process.env.VERCEL_ENV

      nitroConfig.storage['oauth-atproto-state'] = {
        driver: env === 'production' ? 'vercel-kv' : 'vercel-runtime-cache',
      }

      nitroConfig.storage['oauth-atproto-session'] = {
        driver: env === 'production' ? 'vercel-kv' : 'vercel-runtime-cache',
      }
    })
  },
})
