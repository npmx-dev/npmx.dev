import type { H3Event } from 'h3'
import { createError, setHeader } from 'h3'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { INVALID_PACKAGE_PARAM_CACHE_CONTROL } from '#server/utils/package-params'
import { parsePackageParams } from '#server/utils/parse-package-params'
import { VALID_NAMES, VALID_VERSIONS } from '../../../../fixtures/package-coordinates'

const { getVersionsMock, resolvePackageReadmeSourceMock } = vi.hoisted(() => ({
  getVersionsMock: vi.fn(),
  resolvePackageReadmeSourceMock: vi.fn(),
}))
vi.mock('fast-npm-meta', () => ({ getVersions: getVersionsMock }))
vi.mock('#server/utils/readme-loaders', () => ({
  resolvePackageReadmeSource: resolvePackageReadmeSourceMock,
}))

const fetchNpmPackageMock = vi.fn()
const fetchNpmPackageAbbreviatedMock = vi.fn()
const getLikesEvolutionMock = vi.fn()
const $fetchMock = vi.fn()

let routerParams: Record<string, string | undefined> = {}
let queryParams: Record<string, string> = {}

type FakeEvent = H3Event & { url: string; headers: Record<string, string> }

vi.stubGlobal('fetchNpmPackage', fetchNpmPackageMock)
vi.stubGlobal('fetchNpmPackageAbbreviated', fetchNpmPackageAbbreviatedMock)
vi.stubGlobal('$fetch', $fetchMock)
vi.stubGlobal('parsePackageParams', parsePackageParams)
vi.stubGlobal('createError', createError)
vi.stubGlobal('setHeader', setHeader)
vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
vi.stubGlobal('defineEventHandler', (fn: Function) => fn)
vi.stubGlobal('getRouterParam', (_event: unknown, name: string) => routerParams[name])
vi.stubGlobal('getQuery', () => queryParams)
vi.stubGlobal('getRequestURL', (event: FakeEvent) => new URL(event.url, 'http://127.0.0.1'))
vi.stubGlobal(
  'PackageLikesUtils',
  class {
    getLikesEvolution = getLikesEvolutionMock
  },
)
vi.stubGlobal('getPackageFileTree', async () => ({ tree: [] }))
vi.stubGlobal('findSkillDirs', () => [])
vi.stubGlobal('encodePackageName', (name: string) =>
  name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name),
)
vi.stubGlobal('CACHE_MAX_AGE_FIVE_MINUTES', 300)
vi.stubGlobal('CACHE_MAX_AGE_ONE_HOUR', 3600)
vi.stubGlobal('ERROR_NPM_FETCH_FAILED', 'Failed to fetch package from npm registry.')

const handleApiErrorMock = vi.fn((error: unknown, fallback: { statusCode: number }) => {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error
  throw createError(fallback)
}) as unknown as typeof handleApiError
vi.stubGlobal('handleApiError', handleApiErrorMock)

const packument = (await import('#server/api/registry/packument/[...pkg].get')).default
const timeline = (await import('#server/api/registry/timeline/[...pkg].get')).default
const packageMeta = (await import('#server/api/registry/package-meta/[...pkg].get')).default
const licenseChange = (await import('#server/api/registry/license-change/[...pkg].get')).default
const likesEvolution = (await import('#server/api/social/likes-evolution/[...pkg].get')).default
const timelineSizes = (await import('#server/api/registry/timeline/sizes/[...pkg].get')).default
const readme = (await import('#server/api/registry/readme/[...pkg].get')).default
const readmeMarkdown = (await import('#server/api/registry/readme/markdown/[...pkg].get')).default
const downloads = (await import('#server/api/registry/downloads/[...slug].get')).default
const wellKnownSkills = (await import('#server/routes/[pkg]/.well-known/skills/[...skills]'))
  .default

function makeEvent(url = '/'): FakeEvent {
  const headers: Record<string, string> = {}
  return {
    url,
    headers,
    node: {
      res: {
        setHeader: (name: string, value: string) => {
          headers[name] = value
        },
        getHeader: () => undefined,
      },
    },
  } as unknown as FakeEvent
}

function makePackument() {
  return {
    'name': 'my-pkg',
    'dist-tags': { latest: '1.0.0' },
    'versions': { '1.0.0': { version: '1.0.0' } },
    'time': { '1.0.0': '2024-01-01T00:00:00Z', 'modified': '2024-01-01T00:00:00Z' },
    'license': 'MIT',
  }
}

const invalidNames = ['foo bar', '.env', '_next', '-foo', '@scope', '%E0%A4%A']

const handlers = () => [
  { name: 'packument', run: (event: H3Event) => packument(event), upstream: fetchNpmPackageMock },
  { name: 'timeline', run: (event: H3Event) => timeline(event), upstream: fetchNpmPackageMock },
  {
    name: 'package-meta',
    run: (event: H3Event) => packageMeta(event),
    upstream: fetchNpmPackageMock,
  },
  {
    name: 'license-change',
    run: (event: H3Event) => licenseChange(event),
    upstream: fetchNpmPackageMock,
  },
  {
    name: 'likes-evolution',
    run: (event: H3Event) => likesEvolution(event),
    upstream: getLikesEvolutionMock,
  },
  {
    name: 'timeline/sizes',
    run: (event: H3Event) => timelineSizes(event),
    upstream: getVersionsMock,
  },
  {
    name: 'readme',
    run: (event: H3Event) => readme(event),
    upstream: resolvePackageReadmeSourceMock,
  },
  {
    name: 'readme/markdown',
    run: (event: H3Event) => readmeMarkdown(event),
    upstream: resolvePackageReadmeSourceMock,
  },
]

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('package routes reject impossible coordinates before fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParams = {}
    queryParams = {}
    fetchNpmPackageMock.mockResolvedValue(makePackument())
    fetchNpmPackageAbbreviatedMock.mockResolvedValue(makePackument())
    getVersionsMock.mockResolvedValue({ versions: ['1.0.0'], time: {}, distTags: {} })
    $fetchMock.mockResolvedValue({ downloads: 1 })
  })

  it.each(handlers())(
    '$name answers a cacheable 404 for a junk name',
    async ({ run, upstream }) => {
      routerParams = { pkg: 'foo bar' }
      const event = makeEvent()

      await expect(run(event)).rejects.toMatchObject({ statusCode: 404 })

      expect(upstream).not.toHaveBeenCalled()
      expect(event.headers['Cache-Control']).toBe(INVALID_PACKAGE_PARAM_CACHE_CONTROL)
    },
  )

  it.each(invalidNames)('the packument route rejects %s without a registry request', async name => {
    routerParams = { pkg: name }
    await expect(packument(makeEvent())).rejects.toMatchObject({ statusCode: 404 })
    expect(fetchNpmPackageMock).not.toHaveBeenCalled()
  })

  it.each(VALID_NAMES)('the packument route fetches %s', async name => {
    routerParams = { pkg: name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : name }

    await packument(makeEvent())

    expect(fetchNpmPackageMock).toHaveBeenCalledWith(name)
  })

  it.each(VALID_VERSIONS)('the packument route keeps accepting version %s', async version => {
    routerParams = { pkg: 'vue' }
    queryParams = { version }

    await packument(makeEvent())

    expect(fetchNpmPackageMock).toHaveBeenCalledWith('vue')
  })

  it('the packument route rejects a junk version query without a registry request', async () => {
    routerParams = { pkg: 'vue' }
    queryParams = { version: '1.0.0 <script>' }

    await expect(packument(makeEvent())).rejects.toMatchObject({ statusCode: 404 })
    expect(fetchNpmPackageMock).not.toHaveBeenCalled()
  })

  it('accepts legacy package names over 214 characters', async () => {
    routerParams = { pkg: 'a'.repeat(240) }

    await packument(makeEvent())

    expect(fetchNpmPackageMock).toHaveBeenCalledWith('a'.repeat(240))
  })

  it('the version downloads route keeps an encoded scoped name encoded upstream', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 404 }))
    routerParams = { slug: '@nuxt%2Fkit/versions' }

    try {
      await expect(downloads(makeEvent())).rejects.toMatchObject({ statusCode: 404 })
      expect(fetchSpy).toHaveBeenCalledWith('https://api.npmjs.org/versions/@nuxt%2Fkit/last-week')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('the version downloads route rejects a junk name without a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    routerParams = { slug: 'foo%20bar/versions' }
    const event = makeEvent()

    try {
      await expect(downloads(event)).rejects.toMatchObject({ statusCode: 404 })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(event.headers['Cache-Control']).toBe(INVALID_PACKAGE_PARAM_CACHE_CONTROL)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('the well-known skills route rejects a junk name without a registry request', async () => {
    const event = makeEvent('/foo%20bar/.well-known/skills/index.json')

    await expect(wellKnownSkills(event)).rejects.toMatchObject({ statusCode: 404 })
    expect(fetchNpmPackageAbbreviatedMock).not.toHaveBeenCalled()
    expect(event.headers['Cache-Control']).toBe(INVALID_PACKAGE_PARAM_CACHE_CONTROL)
  })

  it('the well-known skills route decodes a scoped name', async () => {
    await expect(
      wellKnownSkills(makeEvent('/@scope%2Fpkg/.well-known/skills/index.json')),
    ).resolves.toBeDefined()
    expect(fetchNpmPackageAbbreviatedMock).toHaveBeenCalledWith('@scope/pkg')
  })
})
