import type * as NuxtServer from 'nuxt/server'
import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import type { H3Event } from 'nitro/h3'
import type { Packument, PackumentVersion } from '#shared/types/npm-registry'

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

const handler = (await import('#server/api/registry/timeline/[...pkg].get')).default

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

describe('timeline API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.routerParam = undefined
    mocks.queryParams = {}
  })

  it('throws 404 when package name param is missing', async () => {
    mocks.routerParam = undefined
    await expect(handler(fakeEvent)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('throws 400 for invalid URI encoding', async () => {
    mocks.routerParam = '%E0%A4%A'
    await expect(handler(fakeEvent)).rejects.toMatchObject({
      status: 400,
    })
  })

  it('returns paginated versions sorted newest-first', async () => {
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = { offset: 0, limit: 10 }

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: 'MIT' },
          '2.0.0': { license: 'ISC' },
          '3.0.0': { license: 'MIT' },
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
          '3.0.0': '2025-01-01T00:00:00Z',
        },
        distTags: { latest: '3.0.0' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.total).toBe(3)
    expect(result.versions).toHaveLength(3)
    // newest first
    expect(result.versions[0]!.version).toBe('3.0.0')
    expect(result.versions[1]!.version).toBe('2.0.0')
    expect(result.versions[2]!.version).toBe('1.0.0')
  })

  it('sorts by semver (highest first, including pre-releases) when sort=semver', async () => {
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = { offset: 0, limit: 10, sort: 'semver' }

    // Publish-time order deliberately differs from semver order: 1.9.0 was
    // published most recently (a back-port), and a pre-release sits between
    // 2.0.0 and 1.9.0 semantically.
    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.9.0': {},
          '2.0.0-beta.1': {},
          '2.0.0': {},
        },
        time: {
          '2.0.0-beta.1': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
          '1.9.0': '2025-01-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.versions.map(v => v.version)).toEqual(['2.0.0', '2.0.0-beta.1', '1.9.0'])
  })

  it('applies offset and limit correctly', async () => {
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = { offset: 1, limit: 1 }

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': {},
          '2.0.0': {},
          '3.0.0': {},
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0': '2024-06-01T00:00:00Z',
          '3.0.0': '2025-01-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.total).toBe(3)
    expect(result.versions).toHaveLength(1)
    // sorted newest first: 3.0.0, 2.0.0, 1.0.0 → offset 1 = 2.0.0
    expect(result.versions[0]!.version).toBe('2.0.0')
  })

  it('defaults offset to 0 and limit to 25', async () => {
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = {}

    const versions: Record<string, {}> = {}
    const time: Record<string, string> = {}
    for (let i = 1; i <= 30; i++) {
      const v = `1.0.${i}`
      versions[v] = {}
      time[v] = new Date(2024, 0, i).toISOString()
    }

    mocks.fetchNpmPackage.mockResolvedValue(makePackument({ versions, time }))

    const result = await handler(fakeEvent)
    expect(result.total).toBe(30)
    expect(result.versions).toHaveLength(25)
  })

  it('clamps limit to max 100', async () => {
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = { limit: 999 }

    const versions: Record<string, {}> = {}
    const time: Record<string, string> = {}
    for (let i = 1; i <= 150; i++) {
      const v = `1.0.${i}`
      versions[v] = {}
      time[v] = new Date(2024, 0, (i % 28) + 1, i % 24).toISOString()
    }

    mocks.fetchNpmPackage.mockResolvedValue(makePackument({ versions, time }))

    const result = await handler(fakeEvent)
    expect(result.versions).toHaveLength(100)
  })

  it('excludes pre-releases when stable-only=true', async () => {
    mocks.routerParam = 'my-pkg'
    mocks.queryParams = { 'stable-only': 'true', 'sort': 'semver' }

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': {},
          '2.0.0-beta.1': {},
          '2.0.0': {},
          '2.1.0-rc.0': {},
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0-beta.1': '2024-02-01T00:00:00Z',
          '2.0.0': '2024-03-01T00:00:00Z',
          '2.1.0-rc.0': '2024-04-01T00:00:00Z',
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.versions.map(v => v.version)).toEqual(['2.0.0', '1.0.0'])
    expect(result.total).toBe(2)
  })

  it('extracts license string from object format', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { license: { type: 'Apache-2.0' } as never },
        },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.versions[0]!.license).toBe('Apache-2.0')
  })

  it('includes tags for versions with dist-tags', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': {},
          '2.0.0-beta.1': {},
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          '2.0.0-beta.1': '2024-06-01T00:00:00Z',
        },
        distTags: { latest: '1.0.0', next: '2.0.0-beta.1' },
      }),
    )

    const result = await handler(fakeEvent)
    const latest = result.versions.find((v: any) => v.version === '1.0.0')
    const next = result.versions.find((v: any) => v.version === '2.0.0-beta.1')
    expect(latest?.tags).toEqual(['latest'])
    expect(next?.tags).toEqual(['next'])
  })

  it('includes module type when present', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { type: 'module' },
        },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.versions[0]!.type).toBe('module')
  })

  it('sets hasTypes when version has types field', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { types: './index.d.ts' },
        },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.versions[0]!.hasTypes).toBe(true)
  })

  it('sets hasTrustedPublisher when trustedPublisher is true', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': { _npmUser: { trustedPublisher: true, name: 'bob' } },
        },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.versions[0]!.hasTrustedPublisher).toBe(true)
  })

  it('sets hasProvenance when attestations exist', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': {
            dist: {
              shasum: 'abc123',
              tarball: 'https://registry.npmjs.org/my-pkg/-/my-pkg-1.0.0.tgz',
              signatures: [],
              attestations: {
                url: 'https://example.com',
                provenance: {
                  predicateType: 'https://npmx.dev/provenance/v9.99',
                },
              },
            },
          },
        },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.versions[0]!.hasProvenance).toBe(true)
  })

  it('omits optional fields when not present', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': {},
        },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
      }),
    )

    const result = await handler(fakeEvent)
    const v = result.versions[0]!
    expect(v.license).toBeUndefined()
    expect(v.type).toBeUndefined()
    expect(v.hasTypes).toBeUndefined()
    expect(v.hasTrustedPublisher).toBeUndefined()
    expect(v.hasProvenance).toBeUndefined()
    expect(v.tags).toEqual([])
  })

  it('skips versions without a time entry', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: {
          '1.0.0': {},
          '2.0.0': {},
        },
        time: {
          '1.0.0': '2024-01-01T00:00:00Z',
          // no time for 2.0.0
        },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.total).toBe(1)
    expect(result.versions[0]!.version).toBe('1.0.0')
  })

  it('decodes scoped package names', async () => {
    mocks.routerParam = '%40scope%2Fmy-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: { '1.0.0': {} },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
      }),
    )

    await handler(fakeEvent)
    expect(mocks.fetchNpmPackage).toHaveBeenCalledWith('@scope/my-pkg')
  })

  it('calls handleApiError when fetchNpmPackage throws', async () => {
    mocks.routerParam = 'my-pkg'
    const error = new Error('upstream failure')
    mocks.fetchNpmPackage.mockRejectedValue(error)

    await expect(handler(fakeEvent)).rejects.toThrow('Failed to fetch timeline for my-pkg')
    expect(handleApiErrorMock).toHaveBeenCalledWith(error, {
      status: 502,
      message: 'Failed to fetch timeline for my-pkg',
    })
  })

  it('supports multiple tags on the same version', async () => {
    mocks.routerParam = 'my-pkg'

    mocks.fetchNpmPackage.mockResolvedValue(
      makePackument({
        versions: { '1.0.0': {} },
        time: { '1.0.0': '2024-01-01T00:00:00Z' },
        distTags: { latest: '1.0.0', stable: '1.0.0' },
      }),
    )

    const result = await handler(fakeEvent)
    expect(result.versions[0]!.tags).toEqual(expect.arrayContaining(['latest', 'stable']))
    expect(result.versions[0]!.tags).toHaveLength(2)
  })
})
