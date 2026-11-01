import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { H3Event } from 'h3'

const createForgeProviderMock = vi.hoisted(() => vi.fn())
const getRouterParamMock = vi.hoisted(() => vi.fn())

vi.mock('h3', () => ({
  createError: vi.fn((options: unknown) => options),
  getRouterParam: getRouterParamMock,
}))

vi.mock('#shared/utils/forges', () => ({
  createForgeProvider: createForgeProviderMock,
  toForgeRepoRef: (ref: unknown) => ref,
}))

vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
// The route uses Nuxt's auto-imported h3 helpers, which unit tests do not get.
vi.stubGlobal('getRouterParam', getRouterParamMock)
vi.stubGlobal(
  'createError',
  vi.fn((options: unknown) => options),
)

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
})
