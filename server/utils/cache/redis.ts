import type { Redis } from '@upstash/redis'

/**
 * Redis cache storage with TTL handled by redis for use in production
 */
export class RedisCacheAdapter implements CacheAdapter {
  private readonly redis: Redis
  private readonly prefix: string

  formatKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  constructor(redis: Redis, prefix: string) {
    this.redis = redis
    this.prefix = prefix
  }

  async get<T>(key: string): Promise<T | undefined> {
    const formattedKey = this.formatKey(key)
    const value = await this.redis.get<T>(formattedKey)
    if (!value) return
    return value
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const formattedKey = this.formatKey(key)
    if (ttl) {
      await this.redis.setex(formattedKey, ttl, value)
    } else {
      await this.redis.set(formattedKey, value)
    }
  }

  async delete(key: string): Promise<void> {
    const formattedKey = this.formatKey(key)
    await this.redis.del(formattedKey)
  }
}
