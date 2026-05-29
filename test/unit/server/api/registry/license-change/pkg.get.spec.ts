import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createError, type H3Event } from 'h3'
import type { Packument, PackumentVersion } from '#shared/types/npm-registry'

const fetchNpmPackageMock = vi.fn()
vi.stubGlobal('fetchNpmPackage', fetchNpmPackageMock)
vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
vi.stubGlobal('createError', createError)

let routerParam: string | undefined
let queryParams: Record<string, string | number> = {}

vi.stubGlobal('getRouterParam', (_event: unknown, _name: string) => routerParam)
vi.stubGlobal('getQuery', () => queryParams)

const handler = (await import('#server/api/registry/license-change/[...pkg].get')).default

function makePackument(opts: {
  versions: Record<string, Partial<PackumentVersion>>
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
    routerParam = 'my-pkg'
    queryParams = {}
  })

  it('does not report a license change for the first package version', async () => {
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

    await expect(handler(fakeEvent)).resolves.toEqual({ change: null })
  })

  it('reports a license change when a previous version exists', async () => {
    queryParams = { version: '2.0.0' }
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

    await expect(handler(fakeEvent)).resolves.toEqual({
      change: {
        from: 'MIT',
        to: 'ISC',
      },
    })
  })
})
