import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import { createError, type H3Event } from 'h3'

const { getVersionsMock } = vi.hoisted(() => ({ getVersionsMock: vi.fn() }))
vi.mock('fast-npm-meta', () => ({ getVersions: getVersionsMock }))

const calculateInstallSizeMock = vi.fn()
vi.stubGlobal('calculateInstallSize', calculateInstallSizeMock)
vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
vi.stubGlobal('CACHE_MAX_AGE_FIVE_MINUTES', 300)

const handleApiErrorMock = vi.fn(
  (_error: unknown, fallback: { statusCode: number; message: string }) => {
    throw createError(fallback)
  },
) as unknown as typeof handleApiError
vi.stubGlobal('handleApiError', handleApiErrorMock)

let routerParam: string | undefined
let queryParams: Record<string, string | number> = {}

vi.stubGlobal('getRouterParam', (_event: unknown, _name: string) => routerParam)
vi.stubGlobal('getQuery', () => queryParams)
vi.stubGlobal('createError', createError)

const handler = (await import('#server/api/registry/timeline/sizes/[...pkg].get')).default

const fakeEvent = {} as H3Event

// calculateInstallSize echoes the version back with a non-zero size so every
// requested version is included; this lets us assert the ordering of the page.
function stubSizes() {
  calculateInstallSizeMock.mockImplementation((_pkg: string, version: string) =>
    Promise.resolve({
      version,
      totalSize: 1000,
      dependencyCount: 1,
      selfSize: 500,
      dependencies: [],
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  routerParam = 'nuxt'
  queryParams = {}
  stubSizes()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('timeline sizes API', () => {
  const versions = ['1.0.0', '2.0.0', '1.5.0-beta.1', '2.1.0', '1.5.0']
  const time: Record<string, string> = {
    '1.0.0': '2024-01-01T00:00:00Z',
    '2.0.0': '2024-02-01T00:00:00Z',
    '1.5.0-beta.1': '2024-03-01T00:00:00Z',
    '2.1.0': '2024-04-01T00:00:00Z',
    '1.5.0': '2024-05-01T00:00:00Z',
  }

  it('sorts a page by semver (descending) when sort=semver', async () => {
    queryParams = { offset: 0, limit: 25, sort: 'semver' }
    getVersionsMock.mockResolvedValue({ versions: [...versions], time })

    const result = await handler(fakeEvent)
    expect(result.sizes.map(s => s.version)).toEqual([
      '2.1.0',
      '2.0.0',
      '1.5.0',
      '1.5.0-beta.1',
      '1.0.0',
    ])
  })

  it('drops pre-releases when stable-only=true', async () => {
    queryParams = { 'offset': 0, 'limit': 25, 'sort': 'semver', 'stable-only': 'true' }
    getVersionsMock.mockResolvedValue({ versions: [...versions], time })

    const result = await handler(fakeEvent)
    expect(result.sizes.map(s => s.version)).toEqual(['2.1.0', '2.0.0', '1.5.0', '1.0.0'])
  })

})
