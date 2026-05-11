import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createError, type H3Event } from 'h3'

const fetchNpmPackageMock = vi.fn()
vi.stubGlobal('fetchNpmPackage', fetchNpmPackageMock)
vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
vi.stubGlobal('createError', createError)

let routerParam: string | undefined
let queryParams: Record<string, string | number> = {}

vi.stubGlobal('getRouterParam', (_event: unknown, _name: string) => routerParam)
vi.stubGlobal('getQuery', () => queryParams)

const handler = (await import('#server/api/registry/license-change/[...pkg].get')).default
const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('license change API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParam = undefined
    queryParams = {}
  })

  it('throws 400 when package name param is missing', async () => {
    await expect(handler(fakeEvent)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('returns no change for a package with only one version', async () => {
    routerParam = 'vsxtools'

    fetchNpmPackageMock.mockResolvedValue({
      versions: {
        '0.0.1': { version: '0.0.1', license: 'MIT' },
      },
      time: {
        '0.0.1': '2026-05-01T00:00:00Z',
      },
    })

    await expect(handler(fakeEvent)).resolves.toEqual({
      change: null,
    })
  })

  it('returns no change when comparing the first published version explicitly', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '1.0.0' }

    fetchNpmPackageMock.mockResolvedValue({
      versions: {
        '1.0.0': { version: '1.0.0', license: 'MIT' },
        '1.1.0': { version: '1.1.0', license: 'Apache-2.0' },
      },
      time: {
        '1.0.0': '2026-01-01T00:00:00Z',
        '1.1.0': '2026-02-01T00:00:00Z',
      },
    })

    await expect(handler(fakeEvent)).resolves.toEqual({
      change: null,
    })
  })

  it('returns the license change when a previous version exists', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '1.1.0' }

    fetchNpmPackageMock.mockResolvedValue({
      versions: {
        '1.0.0': { version: '1.0.0', license: 'MIT' },
        '1.1.0': { version: '1.1.0', license: 'Apache-2.0' },
      },
      time: {
        '1.0.0': '2026-01-01T00:00:00Z',
        '1.1.0': '2026-02-01T00:00:00Z',
      },
    })

    await expect(handler(fakeEvent)).resolves.toEqual({
      change: {
        from: 'MIT',
        to: 'Apache-2.0',
      },
    })
  })
})
