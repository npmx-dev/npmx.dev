import { Redis } from '@upstash/redis'
import { LocalCacheAdapter } from '#server/utils/cache/local'
import { useRuntimeConfig } from 'nuxt/server'
import { RedisCacheAdapter } from '#server/utils/cache/redis'
import type { CacheAdapter } from '#server/utils/cache/shared'

export function getCacheAdapter(prefix: string): CacheAdapter {
  const config = useRuntimeConfig()

  if (!import.meta.dev && config.upstash?.redisRestUrl && config.upstash?.redisRestToken) {
    const redis = new Redis({
      url: config.upstash.redisRestUrl,
      token: config.upstash.redisRestToken,
    })
    return new RedisCacheAdapter(redis, prefix)
  }
  return new LocalCacheAdapter()
}
