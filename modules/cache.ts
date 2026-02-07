import process from 'node:process'
import { defineNuxtModule, useRuntimeConfig } from 'nuxt/kit'
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

    const config = useRuntimeConfig()

    nuxt.hook('nitro:config', nitroConfig => {
      nitroConfig.storage = nitroConfig.storage || {}

      const upstash = {
        driver: 'upstash' as const,
        url: config.upstash.redisRestUrl,
        token: config.upstash.redisRestToken,
      }

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
      nitroConfig.storage.atproto =
        env === 'production' ? upstash : { driver: 'vercel-runtime-cache' }
    })
  },
})
