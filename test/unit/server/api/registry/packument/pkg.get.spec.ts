import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createError, type H3Event } from 'h3'
import { NPM_REGISTRY } from '#shared/utils/constants'
import { encodePackageName } from '#shared/utils/npm'
import type { Packument, PackumentVersion } from '#shared/types/npm-registry'

const npmFetchMock = vi.fn()
vi.stubGlobal('$fetch', npmFetchMock)
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

vi.stubGlobal('getRouterParam', () => routerParam)
vi.stubGlobal('getQuery', () => queryParams)
vi.stubGlobal('createError', createError)

const handler = (await import('#server/api/registry/packument/[...pkg].get')).default

function makePackument(opts: {
  versions: Record<string, Partial<PackumentVersion>>
  time: Record<string, string>
  distTags?: Record<string, string>
  license?: string
}): Packument {
  return {
    'name': 'my-pkg',
    'dist-tags': opts.distTags ?? {},
    'versions': Object.fromEntries(
      Object.entries(opts.versions).map(([v, data]) => [v, { version: v, ...data }]),
    ),
    'time': opts.time,
    'license': opts.license,
  } as unknown as Packument
}

const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('packument API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParam = undefined
    queryParams = {}
  })

  it('throws 404 when the package name param is missing', async () => {
    routerParam = undefined
    await expect(handler(fakeEvent)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('defaults to the latest dist-tag when no version is requested', async () => {
    routerParam = 'my-pkg'
    npmFetchMock.mockResolvedValue(
      makePackument({
        versions: { '1.0.0': {}, '2.0.0': {} },
        time: { '1.0.0': '2024-01-01T00:00:00Z', '2.0.0': '2025-01-01T00:00:00Z' },
        distTags: { latest: '2.0.0' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.requestedVersion?.version).toBe('2.0.0')
    expect(result['dist-tags'].latest).toBe('2.0.0')
  })

  it('resolves an exact version', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '1.0.0' }
    npmFetchMock.mockResolvedValue(
      makePackument({
        versions: { '1.0.0': {}, '2.0.0': {} },
        time: { '1.0.0': '2024-01-01T00:00:00Z', '2.0.0': '2025-01-01T00:00:00Z' },
        distTags: { latest: '2.0.0' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.requestedVersion?.version).toBe('1.0.0')
  })

  it('resolves a dist-tag to its concrete version', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: 'next' }
    npmFetchMock.mockResolvedValue(
      makePackument({
        versions: { '1.0.0': {}, '2.0.0-beta.1': {} },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0-beta.1': '2025-01-01T00:00:00Z',
        },
        distTags: { latest: '1.0.0', next: '2.0.0-beta.1' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.requestedVersion?.version).toBe('2.0.0-beta.1')
  })

  it('includes no requestedVersion for an unresolvable version', async () => {
    routerParam = 'my-pkg'
    queryParams = { version: '9.9.9' }
    npmFetchMock.mockResolvedValue(
      makePackument({
        versions: { '1.0.0': {} },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
        distTags: { latest: '1.0.0' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.requestedVersion).toBeNull()
  })

  it('fetches the encoded package name from the npm registry', async () => {
    routerParam = '%40scope%2Fmy-pkg'
    npmFetchMock.mockResolvedValue(
      makePackument({
        versions: { '1.0.0': {} },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
        distTags: { latest: '1.0.0' },
      }),
    )

    await handler(fakeEvent)
    expect(npmFetchMock).toHaveBeenCalledWith(
      `${NPM_REGISTRY}/${encodePackageName('@scope/my-pkg')}`,
    )
  })

  it('calls handleApiError when the registry fetch fails', async () => {
    routerParam = 'my-pkg'
    const error = new Error('upstream failure')
    npmFetchMock.mockRejectedValue(error)

    await expect(handler(fakeEvent)).rejects.toMatchObject({ statusCode: 502 })
    expect(handleApiErrorMock).toHaveBeenCalledWith(error, {
      statusCode: 502,
      message: expect.any(String),
    })
  })
})
