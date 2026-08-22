import { beforeEach, describe, expect, it, vi, afterAll } from 'vitest'
import { createError, type H3Event } from 'h3'

const getVersionsMock = vi.hoisted(() => vi.fn())

vi.mock('fast-npm-meta', () => ({
  getVersions: getVersionsMock,
}))

const calculateInstallSizeMock = vi.fn(async (_packageName: string, version: string) => ({
  version,
  totalSize: 1_000,
  dependencyCount: 1,
  selfSize: 500,
  dependencies: [{ name: 'dependency', size: 500 }],
}))

vi.stubGlobal('calculateInstallSize', calculateInstallSizeMock)
vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
vi.stubGlobal('CACHE_MAX_AGE_FIVE_MINUTES', 300)

let routerParam: string | undefined
let queryParams: Record<string, string | number | string[]> = {}

vi.stubGlobal('getRouterParam', () => routerParam)
vi.stubGlobal('getQuery', () => queryParams)
vi.stubGlobal('createError', createError)

const handler = (await import('#server/api/registry/timeline/sizes/[...pkg].get')).default
const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('timeline sizes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParam = 'my-pkg'
    queryParams = {}
  })

  it('filters stable versions before applying pagination', async () => {
    queryParams = { offset: 1, limit: 2, stable: ['true'] }
    getVersionsMock.mockResolvedValue({
      versions: [
        '1.0.0',
        '2.0.0',
        '3.0.0',
        '4.0.0-beta.1',
        '4.0.0-beta.2',
        '4.0.0-beta.3',
        'nightly',
      ],
      time: {
        '1.0.0': '2024-01-01T00:00:00Z',
        '2.0.0': '2024-02-01T00:00:00Z',
        '3.0.0': '2024-03-01T00:00:00Z',
        '4.0.0-beta.1': '2024-04-01T00:00:00Z',
        '4.0.0-beta.2': '2024-05-01T00:00:00Z',
        '4.0.0-beta.3': '2024-06-01T00:00:00Z',
        'nightly': '2024-07-01T00:00:00Z',
      },
    })

    const result = await handler(fakeEvent)

    expect(calculateInstallSizeMock.mock.calls).toEqual([
      ['my-pkg', '2.0.0'],
      ['my-pkg', '1.0.0'],
    ])
    expect(result.sizes.map(entry => entry.version)).toEqual(['2.0.0', '1.0.0'])
  })
})
