import type * as NuxtServer from 'nuxt/server'
import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import type { H3Event } from 'nitro/h3'
import type { Packument, PackumentLicense, PackumentVersion } from '#shared/types/npm-registry'

const handleApiErrorMock = vi.hoisted(() =>
  vi.fn((_error: unknown, fallback: { status: number; message: string }) => {
    throw Object.assign(new Error(fallback.message), fallback)
  }),
)

const mocks = vi.hoisted(() => ({
  fetchNpmPackage: vi.fn(),
  routerParam: undefined as string | undefined,
  queryParams: {} as Record<string, string | number>,
}))

vi.mock('#server/utils/npm', () => ({ fetchNpmPackage: mocks.fetchNpmPackage }))
vi.mock('#server/utils/cached-handler', () => ({
  defineCachedEventHandler: (fn: Function) => fn,
}))
vi.mock('#server/utils/error-handler', () => ({
  handleApiError: handleApiErrorMock,
}))
vi.mock('nuxt/server', async importOriginal => ({
  ...(await importOriginal<typeof NuxtServer>()),
  getRouterParam: () => mocks.routerParam,
  getQuery: () => mocks.queryParams,
}))

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
    mocks.routerParam = undefined
    mocks.queryParams = {}
  })

  it('throws 400 when package name param is missing', async () => {
    mocks.routerParam = undefined
    await expect(handler(fakeEvent)).rejects.toMatchObject({ status: 400 })
  })

  it('reports no change for a new package with a single version (issue #2720)', async () => {
    mocks.routerParam = 'vsxtools'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: { '0.0.1': { license: 'MIT' } },
        time: { '0.0.1': '2024-01-01T00:00:00Z' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.change).toBeNull()
  })

  it('reports a change when the license changed between versions', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
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
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
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
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
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
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = {}

    mocks.fetchNpmPackage.mockResolvedValue(
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
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = { version: '2.0.0' }

    mocks.fetchNpmPackage.mockResolvedValue(
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
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = { version: '1.0.0' }

    mocks.fetchNpmPackage.mockResolvedValue(
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
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = { version: '9.9.9' }

    mocks.fetchNpmPackage.mockResolvedValue(
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
