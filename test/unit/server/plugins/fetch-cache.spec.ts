import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
vi.mock('ofetch', () => ({ $fetch: fetchMock }))

vi.stubGlobal('defineNitroPlugin', (setup: Function) => setup)

const plugin = (await import('#server/plugins/fetch-cache')).default

type CachedFetch = (
  url: string,
  options?: { baseURL?: string; query?: Record<string, string> },
) => Promise<{ data: unknown }>

/**
 * Boots the plugin with a fresh in-memory storage and returns that storage plus a
 * request-scoped cachedFetch. Everything mutable lives here, per test invocation.
 */
function bootstrap() {
  const store = new Map<string, unknown>()
  const storage = {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
  }
  vi.stubGlobal('useStorage', () => storage)

  let requestHook: ((event: unknown) => void) | undefined
  plugin({
    hooks: {
      hook: (name: string, fn: (event: unknown) => void) => {
        if (name === 'request') requestHook = fn
      },
    },
  } as never)

  const cachedFetch: CachedFetch = (url, options) => {
    const event = { context: {} as { cachedFetch?: CachedFetch }, waitUntil: () => {} }
    requestHook!(event)
    return event.context.cachedFetch!(url, options)
  }

  return { storage, cachedFetch }
}

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('fetch-cache plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ name: 'vite' })
  })

  it('caches a relative request when baseURL resolves to an allowlisted host', async () => {
    const { storage, cachedFetch } = bootstrap()
    const result = await cachedFetch('/vite', { baseURL: 'https://registry.npmjs.org' })

    expect(fetchMock).toHaveBeenCalledWith('/vite', { baseURL: 'https://registry.npmjs.org' })
    expect(result.data).toEqual({ name: 'vite' })
    expect(storage.setItem).toHaveBeenCalledTimes(1)

    const key = storage.setItem.mock.calls[0]![0]
    expect(key).toContain('registry.npmjs.org')
    expect(key).toContain('/vite')
  })

  it('serves a fresh cached entry without re-fetching', async () => {
    const { cachedFetch } = bootstrap()
    await cachedFetch('/vite', { baseURL: 'https://registry.npmjs.org' })
    const result = await cachedFetch('/vite', { baseURL: 'https://registry.npmjs.org' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.data).toEqual({ name: 'vite' })
  })

  it('uses separate cache entries for requests that differ only in query options', async () => {
    const { cachedFetch } = bootstrap()
    const baseURL = 'https://registry.npmjs.org'
    fetchMock.mockResolvedValueOnce({ name: 'vue' }).mockResolvedValueOnce({ name: 'react' })

    await cachedFetch('/-/v1/search', { baseURL, query: { text: 'vue' } })
    const result = await cachedFetch('/-/v1/search', { baseURL, query: { text: 'react' } })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.data).toEqual({ name: 'react' })
  })

  it('does not cache when the URL cannot be resolved (no baseURL)', async () => {
    const { storage, cachedFetch } = bootstrap()
    await cachedFetch('/vite')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('does not cache a non-allowlisted host', async () => {
    const { storage, cachedFetch } = bootstrap()
    await cachedFetch('/vite', { baseURL: 'https://example.com' })

    expect(storage.setItem).not.toHaveBeenCalled()
  })
})
