import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import type { Packument } from '#shared/types/npm-registry'
import { parsePackageParams } from '#server/utils/parse-package-params'

const fetchNpmPackageMock = vi.hoisted(() => vi.fn())
const getRouterParamMock = vi.hoisted(() => vi.fn())
const getQueryMock = vi.hoisted(() => vi.fn())
const setHeaderMock = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/npm', () => ({
  fetchNpmPackage: fetchNpmPackageMock,
}))

vi.mock('h3', () => ({
  createError: vi.fn((options: unknown) => options),
  getRouterParam: getRouterParamMock,
  getQuery: getQueryMock,
  setHeader: setHeaderMock,
}))

vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
vi.stubGlobal('parsePackageParams', parsePackageParams)

const handler = (await import('#server/api/registry/badge/[type]/[...pkg].get')).default

const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('badge API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getQueryMock.mockReturnValue({})
    getRouterParamMock.mockImplementation((_event: unknown, name: string) => {
      if (name === 'type') return 'license'
      if (name === 'pkg') return 'my-pkg'
      return undefined
    })
  })

  it('normalizes object-shaped licenses before rendering SVG', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      '_id': 'my-pkg',
      '_rev': '1',
      'name': 'my-pkg',
      'dist-tags': { latest: '1.0.0' },
      'versions': {
        '1.0.0': { version: '1.0.0', license: { type: 'MIT' } },
      },
      'time': {},
    } as unknown as Packument)

    const svg = await handler(fakeEvent)

    expect(svg).toContain('>MIT<')
    expect(svg).not.toContain('[object Object]')
  })

  it('omits vulnerabilities excluded by last_known_affected_version_range', async () => {
    getRouterParamMock.mockImplementation((_event: unknown, name: string) => {
      if (name === 'type') return 'vulnerabilities'
      if (name === 'pkg') return 'nuxt'
      return undefined
    })
    fetchNpmPackageMock.mockResolvedValue({
      'name': 'nuxt',
      'dist-tags': { latest: '4.6.3' },
      'versions': { '4.6.3': { version: '4.6.3' } },
      'time': {},
    } as unknown as Packument)
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        vulns: [
          {
            id: 'GHSA-vjh5-4x84-xrqp',
            modified: '2026-10-22',
            affected: [
              {
                package: { ecosystem: 'npm', name: 'nuxt' },
                ranges: [{ type: 'SEMVER', events: [{ introduced: '3.0.0' }] }],
                database_specific: { last_known_affected_version_range: '< 4.0.0' },
              },
            ],
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const svg = await handler(fakeEvent)

    expect(fetchMock).toHaveBeenCalledWith('https://api.osv.dev/v1/query', expect.anything())
    expect(svg).toContain('>0<')
  })
})
