/**
 * Generic cache adapter to allow using a local cache during development and redis in production
 */
export interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
}
