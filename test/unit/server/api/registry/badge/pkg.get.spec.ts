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
})
