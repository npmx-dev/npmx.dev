import { Redis } from '@upstash/redis'

export function getCacheAdatper(prefix: string): CacheAdapter {
  const config = useRuntimeConfig()

  if (!import.meta.dev && config.upstash?.redisRestUrl && config.upstash?.redisRestToken) {
    const redis = new Redis({
      url: config.upstash.redisRestUrl,
      token: config.upstash.redisRestToken,
    })
    return new RedisCacheAdatper(redis, prefix)
  }
  return new LocalCacheAdapter()
}
