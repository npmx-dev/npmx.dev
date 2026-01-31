import type { RuntimeLock } from '@atproto/oauth-client-node'
import { requestLocalLock } from '@atproto/oauth-client-node'
import { Redis } from '@upstash/redis'

type Awaitable<T> = T | PromiseLike<T>

/**
 * Creates a distributed lock using Upstash Redis.
 * Falls back gracefully if the lock cannot be acquired.
 */
function createUpstashLock(redis: Redis): RuntimeLock {
  return async <T>(key: string, fn: () => Awaitable<T>): Promise<T> => {
    const lockKey = `oauth:lock:${key}`
    const lockValue = crypto.randomUUID()
    const lockTTL = 30 // seconds

    // Try to acquire lock with NX (only set if not exists) and EX (expire)
    const acquired = await redis.set(lockKey, lockValue, {
      nx: true,
      ex: lockTTL,
    })

    if (!acquired) {
      // Another instance holds the lock, wait briefly and retry once
      await new Promise(resolve => setTimeout(resolve, 100))
      const retryAcquired = await redis.set(lockKey, lockValue, {
        nx: true,
        ex: lockTTL,
      })
      if (!retryAcquired) {
        // Still can't acquire, proceed without lock (better than failing)
        // The worst case is a token refresh race, which will just require re-auth
        return await fn()
      }
    }

    try {
      return await fn()
    } finally {
      // Release lock only if we still own it (compare-and-delete)
      const currentValue = await redis.get(lockKey)
      if (currentValue === lockValue) {
        await redis.del(lockKey)
      }
    }
  }
}

/**
 * Returns the appropriate lock mechanism based on environment:
 * - Production with Upstash config: distributed Redis lock
 * - Otherwise: in-memory lock (sufficient for single instance)
 */
export function getOAuthLock(): RuntimeLock {
  const config = useRuntimeConfig()

  // Use distributed lock in production if Upstash is configured
  if (!import.meta.dev && config.upstash?.redisRestUrl && config.upstash?.redisRestToken) {
    const redis = new Redis({
      url: config.upstash.redisRestUrl,
      token: config.upstash.redisRestToken,
    })
    return createUpstashLock(redis)
  }

  // Fall back to in-memory lock for dev/preview or when Redis isn't configured
  return requestLocalLock
}
