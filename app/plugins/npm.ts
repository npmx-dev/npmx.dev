export default defineNuxtPlugin(() => {
  const cachedFetch = useCachedFetch()

  return {
    provide: {
      npmRegistry: <T>(
        url: Parameters<CachedFetchFunction>[0],
        options?: Parameters<CachedFetchFunction>[1],
        ttl?: Parameters<CachedFetchFunction>[2],
      ) => {
        return cachedFetch<T>(url, { baseURL: NPM_REGISTRY, ...options }, ttl)
      },
      npmApi: <T>(
        url: Parameters<CachedFetchFunction>[0],
        options?: Parameters<CachedFetchFunction>[1],
        ttl?: Parameters<CachedFetchFunction>[2],
      ) => {
        return cachedFetch<T>(url, { baseURL: NPM_API, ...options }, ttl)
      },
    },
  }
})
