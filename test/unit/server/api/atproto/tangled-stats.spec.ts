import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { H3Event } from 'nitro/h3'
import type * as NuxtServer from 'nuxt/server'

const createForgeProviderMock = vi.hoisted(() => vi.fn())
const getRouterParamMock = vi.hoisted(() => vi.fn())

vi.mock('nuxt/server', async importOriginal => ({
  ...(await importOriginal<typeof NuxtServer>()),
  createError: vi.fn((options: unknown) => options),
  getRouterParam: getRouterParamMock,
}))

vi.mock('#server/utils/cached-handler', () => ({
  defineCachedEventHandler: (fn: Function) => fn,
}))

vi.mock('#shared/utils/forges', () => ({
  createForgeProvider: createForgeProviderMock,
  toForgeRepoRef: (ref: unknown) => ref,
}))

const handler = (await import('#server/api/atproto/tangled-stats/[owner]/[...repo].get')).default
const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('tangled stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRouterParamMock.mockImplementation((_event: unknown, name: string) =>
      name === 'owner' ? 'evil.test' : 'repo',
    )
  })

  it('refuses a private host before fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    createForgeProviderMock.mockImplementation(
      async (_ref: unknown, options: { fetch: (url: string) => Promise<Response> }) => ({
        repos: {
          get: () => options.fetch('http://127.0.0.1:8080/xrpc/org.tangled.repo.get'),
        },
      }),
    )

    await expect(handler(fakeEvent)).rejects.toThrow(/Refusing to fetch/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the counts the forge reported, without inventing zeros', async () => {
    createForgeProviderMock.mockResolvedValue({
      repos: { get: async () => ({ stars: 3 }) },
    })

    await expect(handler(fakeEvent)).resolves.toEqual({ stars: 3, forks: undefined })
  })
})
