import { describe, expect, it, vi, beforeEach, afterAll } from 'vite-plus/test'
import { createError, type H3Event } from 'h3'
import { parseVersionRange } from '#server/utils/compare'
import { handleApiError } from '#server/utils/error-handler'
import { parsePackageParams } from '#server/utils/parse-package-params'

interface CacheOptions {
  getKey: (event: H3Event) => string
}

let cacheOptions: CacheOptions | undefined
vi.stubGlobal('defineCachedEventHandler', (fn: Function, options: CacheOptions) => {
  cacheOptions = options
  return fn
})
vi.stubGlobal('CACHE_MAX_AGE_ONE_YEAR', 31536000)
vi.stubGlobal('createError', createError)
vi.stubGlobal('handleApiError', handleApiError)
vi.stubGlobal('parsePackageParams', parsePackageParams)
vi.stubGlobal('parseVersionRange', parseVersionRange)
vi.stubGlobal('getLanguageFromPath', () => 'javascript')
vi.stubGlobal('getShikiHighlighter', async () => null)

let routerParam: string | undefined
let queryParams: Record<string, string> = {}
vi.stubGlobal('getRouterParam', () => routerParam)
vi.stubGlobal('getQuery', () => queryParams)

const setResponseHeaderMock = vi.fn()
vi.stubGlobal('setResponseHeader', setResponseHeaderMock)

const files: Record<string, string> = {
  'https://cdn.jsdelivr.net/npm/pkg@1.0.0/index.js': 'a\nb\n',
  'https://cdn.jsdelivr.net/npm/pkg@1.0.1/index.js': 'a\nc\n',
}
vi.stubGlobal('fetch', async (url: string) => {
  const body = files[url]
  return body === undefined ? new Response(null, { status: 404 }) : new Response(body)
})

const handler = (await import('#server/api/registry/compare-file/[...pkg].get')).default

const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('compare-file API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParam = 'pkg/v/1.0.0...1.0.1/index.js'
    queryParams = {}
  })

  it('returns a plain text unified diff with format=diff', async () => {
    queryParams = { format: 'diff' }

    const result = await handler(fakeEvent)

    expect(setResponseHeaderMock).toHaveBeenCalledWith(
      fakeEvent,
      'Content-Type',
      'text/plain; charset=utf-8',
    )
    expect(result).toBe('--- a/index.js\n+++ b/index.js\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n')
  })

  it('keeps returning the structured diff by default', async () => {
    const result = await handler(fakeEvent)

    expect(setResponseHeaderMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ type: 'modify', stats: { additions: 1, deletions: 1 } })
  })

  it('caches the raw diff separately from the structured diff', () => {
    const jsonKey = cacheOptions!.getKey(fakeEvent)
    queryParams = { format: 'diff', maxChangeRatio: '0.9' }
    const rawKey = cacheOptions!.getKey(fakeEvent)
    queryParams = { format: 'diff' }

    expect(rawKey).not.toBe(jsonKey)
    expect(cacheOptions!.getKey(fakeEvent)).toBe(rawKey)
  })
})
