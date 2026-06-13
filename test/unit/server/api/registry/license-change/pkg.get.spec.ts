import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import { createError, type H3Event } from 'h3'
import type { Packument, PackumentLicense, PackumentVersion } from '#shared/types/npm-registry'

const fetchNpmPackageMock = vi.fn()
vi.stubGlobal('fetchNpmPackage', fetchNpmPackageMock)
vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)

let routerParam: string | undefined
let queryParams: Record<string, string | number> = {}

vi.stubGlobal('getRouterParam', (_event: unknown, _name: string) => routerParam)
vi.stubGlobal('getQuery', () => queryParams)
vi.stubGlobal('createError', createError)

const handler = (await import('#server/api/registry/license-change/[...pkg].get')).default

function makePackument(opts: {
  versions: Record<
    string,
    Partial<Omit<PackumentVersion, 'license'>> & { license?: PackumentLicense }
  >
  time: Record<string, string>
}): Packument {
  return {
    'dist-tags': {},
    'versions': Object.fromEntries(
      Object.entries(opts.versions).map(([v, data]) => [v, { version: v, ...data }]),
    ),
    'time': opts.time,
  } as Packument
}

const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('license-change API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParam = undefined
    queryParams = {}
  })

  it('throws 400 when package name param is missing', async () => {
    routerParam = undefined
    await expect(handler(fakeEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('reports no change for a new package with a single version (issue #2720)', async () => {
    routerParam = 'vsxtools'

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: { '0.0.1': { license: 'MIT' } },
        time: { '0.0.1': '2024-01-01T00:00:00Z' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toBeNull()
  })

  it('reports a change when the license changed between versions', async () => {
    routerParam = 'my-pkg'

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'ISC' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toEqual({ from: 'MIT', to: 'ISC' })
  })

  it('reports no change when the license is unchanged between versions', async () => {
    routerParam = 'my-pkg'

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'MIT' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toBeNull()
  })

  it('extracts license string from object format', async () => {
    routerParam = 'my-pkg'

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: { type: 'MIT' } },
          '2.0.0': { license: { type: 'Apache-2.0', url: 'https://example.com' } },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toEqual({ from: 'MIT', to: 'Apache-2.0' })
  })

  it('defaults to the latest (chronologically newest) version', async () => {
    routerParam = 'my-pkg'
    queryParams = {}

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'MIT' },
          '3.0.0': { license: 'Apache-2.0' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
          '3.0.0': '2025-01-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toEqual({ from: 'MIT', to: 'Apache-2.0' })
  })

  it('compares the requested version against its predecessor', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '2.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'ISC' },
          '3.0.0': { license: 'Apache-2.0' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
          '3.0.0': '2025-01-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toEqual({ from: 'MIT', to: 'ISC' })
  })

  it('reports no change when the requested version is the oldest', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '1.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'ISC' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toBeNull()
  })

  it('reports no change when the requested version is not found', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '9.9.9' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'ISC' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toBeNull()
  })
})
