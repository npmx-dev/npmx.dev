import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import { createError, type H3Event } from 'h3'
import type { Packument, PackumentVersion } from '#shared/types/npm-registry'

const fetchNpmPackageMock = vi.fn()
vi.stubGlobal('fetchNpmPackage', fetchNpmPackageMock)
vi.stubGlobal('defineCachedEventHandler', (fn: (event: unknown) => unknown) => fn)

let routerParam: string | undefined
let queryParams: Record<string, string | number> = {}

vi.stubGlobal('getRouterParam', (_event: unknown, _name: string) => routerParam)
vi.stubGlobal('getQuery', () => queryParams)
vi.stubGlobal('createError', createError)

const handler = (await import('#server/api/registry/license-change/[...pkg].get')).default

function makePackument(opts: {
  versions: Record<string, Partial<PackumentVersion>>
  time: Record<string, string>
  distTags?: Record<string, string>
}): Packument {
  return {
    'dist-tags': opts.distTags ?? {},
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
    await expect(handler(fakeEvent)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 404 when package metadata not found', async () => {
    routerParam = 'my-pkg'
    fetchNpmPackageMock.mockResolvedValue({
      versions: undefined,
      time: undefined,
    })

    await expect(handler(fakeEvent)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('detects license change between versions', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '2.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'ISC' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-02-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toEqual({
      from: 'MIT',
      to: 'ISC',
    })
  })

  it('returns null change when license is the same', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '2.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'MIT' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-02-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toBeNull()
  })

  it('returns null change for first version (no previous version)', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '1.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toBeNull()
  })

  it('defaults to latest version when no version query param', async () => {
    routerParam = 'my-pkg'

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'ISC' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-02-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toEqual({
      from: 'MIT',
      to: 'ISC',
    })
  })

  it('handles missing license field as UNKNOWN', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '2.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': {}, // no license
          '2.0.0': { license: 'MIT' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-02-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toEqual({
      from: 'UNKNOWN',
      to: 'MIT',
    })
  })

  it('handles object format licenses (extracts type field)', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '2.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: { type: 'Apache-2.0' } as never },
          '2.0.0': { license: 'ISC' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-02-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toEqual({
      from: 'Apache-2.0',
      to: 'ISC',
    })
  })

  it('regression test: does not show UNKNOWN for first package version', async () => {
    // This is the regression test for issue #2720
    // When a package has only one version (first release),
    // the license change should be null, not showing a warning
    routerParam = 'new-pkg'
    queryParams = { version: '1.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    // The change should be null because there is no previous version
    // This prevents the misleading message: "License changed from UNKNOWN to MIT"
    expect(result.change).toBeNull()
  })

  it('handles sorting by version chronologically', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '3.0.0' }

    fetchNpmPackageMock.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '3.0.0': { license: 'Apache-2.0' },
          '2.0.0': { license: 'ISC' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '3.0.0': '2024-03-01T00:00:00Z',
          '2.0.0': '2024-02-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    // 3.0.0 compared to previous (2.0.0 chronologically)
    expect(result.change).toEqual({
      from: 'ISC',
      to: 'Apache-2.0',
    })
  })

  it('throws error when fetchNpmPackage fails', async () => {
    routerParam = 'my-pkg'
    const error = new Error('upstream failure')
    fetchNpmPackageMock.mockRejectedValue(error)

    await expect(handler(fakeEvent)).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
