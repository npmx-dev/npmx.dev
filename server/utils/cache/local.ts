/**
 * Local cache data entry
 */
interface LocalCachedEntry<T = unknown> {
  value: T
  ttl?: number
  cachedAt: number
}

/**
 * Checks to see if a cache entry is stale locally
 * @param entry - The entry from the locla cache
 * @returns
 */
function isCacheEntryStale(entry: LocalCachedEntry): boolean {
  if (!entry.ttl) return false
  const now = Date.now()
  const expiresAt = entry.cachedAt + entry.ttl * 1000
  return now > expiresAt
}

/**
 * Local implmentation of a cache to be used during development
 */
export class LocalCacheAdapter implements CacheAdapter {
  private readonly storage = useStorage('atproto:generic')

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.storage.getItem<LocalCachedEntry<T>>(key)
    if (!result) return
    if (isCacheEntryStale(result)) {
      await this.storage.removeItem(key)
      return
    }
    return result.value
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.storage.setItem(key, { value, ttl, cachedAt: Date.now() })
  }

  async delete(key: string): Promise<void> {
    await this.storage.removeItem(key)
  }
}
