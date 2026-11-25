import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createError, type H3Event } from 'h3'
import { assertValidPackageName } from '#shared/utils/npm'
import { parsePackageParam } from '#shared/utils/parse-package-param'

const generateDocsWithDenoMock = vi.fn()
const setResponseHeaderMock = vi.fn()
const setResponseStatusMock = vi.fn()

let routerParam: string | undefined

vi.stubGlobal('defineEventHandler', (fn: Function) => fn)
vi.stubGlobal('getRouterParam', () => routerParam)
vi.stubGlobal('createError', createError)
vi.stubGlobal('parsePackageParam', parsePackageParam)
vi.stubGlobal('assertValidPackageName', assertValidPackageName)
vi.stubGlobal('generateDocsWithDeno', generateDocsWithDenoMock)
vi.stubGlobal('setResponseHeader', setResponseHeaderMock)
vi.stubGlobal('setResponseStatus', setResponseStatusMock)

const handler = (await import('#server/api/registry/docs/[...pkg].get')).default

const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('docs API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParam = undefined
  })

  it('throws 404 when package name or version is missing', async () => {
    routerParam = undefined
    await expect(handler(fakeEvent)).rejects.toMatchObject({ statusCode: 404 })

    routerParam = 'ufo'
    await expect(handler(fakeEvent)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 200 for complete docs so ISR caches them', async () => {
    routerParam = 'ufo/v/1.6.4'
    generateDocsWithDenoMock.mockResolvedValue({
      html: '<section>docs</section>',
      toc: '<ul></ul>',
    })

    const result = await handler(fakeEvent)

    expect(result).toEqual({
      package: 'ufo',
      version: '1.6.4',
      html: '<section>docs</section>',
      toc: '<ul></ul>',
      status: 'ok',
    })
    expect(setResponseStatusMock).not.toHaveBeenCalled()
    expect(setResponseHeaderMock).not.toHaveBeenCalled()
  })

  it.each(['entry-limit', 'fetch-limit', 'timeout'] as const)(
    'returns 200 with truncated flag for %s partials without upstream failures',
    async truncationReason => {
      routerParam = 'effect/v/3.19.19'
      generateDocsWithDenoMock.mockResolvedValue({
        html: '<section>partial</section>',
        toc: '<ul></ul>',
        truncated: true,
        truncationReason,
      })

      const result = await handler(fakeEvent)

      expect(result).toMatchObject({
        status: 'ok',
        truncated: true,
      })
      expect(setResponseStatusMock).not.toHaveBeenCalled()
      expect(setResponseHeaderMock).not.toHaveBeenCalled()
    },
  )

  it('returns 503 no-store with partial body when upstream failures caused truncation', async () => {
    routerParam = 'effect/v/3.19.19'
    generateDocsWithDenoMock.mockResolvedValue({
      html: '<section>partial</section>',
      toc: '<ul></ul>',
      truncated: true,
      truncationReason: 'upstream-error',
    })

    const result = await handler(fakeEvent)

    expect(result).toEqual({
      package: 'effect',
      version: '3.19.19',
      html: '<section>partial</section>',
      toc: '<ul></ul>',
      status: 'ok',
      truncated: true,
    })
    expect(setResponseStatusMock).toHaveBeenCalledWith(fakeEvent, 503)
    expect(setResponseHeaderMock).toHaveBeenCalledWith(fakeEvent, 'Cache-Control', 'no-store')
  })

  it('returns 200 when types are genuinely missing', async () => {
    routerParam = 'is-odd/v/3.0.1'
    generateDocsWithDenoMock.mockResolvedValue(null)

    const result = await handler(fakeEvent)

    expect(result).toMatchObject({
      package: 'is-odd',
      version: '3.0.1',
      status: 'missing',
    })
    expect(setResponseStatusMock).not.toHaveBeenCalled()
    expect(setResponseHeaderMock).not.toHaveBeenCalled()
  })

  it('returns 503 with no-store when doc generation throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    routerParam = 'ufo/v/1.6.4'
    generateDocsWithDenoMock.mockRejectedValue(new Error('esm.sh 503'))

    const result = await handler(fakeEvent)

    expect(result).toEqual({
      package: 'ufo',
      version: '1.6.4',
      html: '',
      toc: null,
      status: 'error',
      message: 'Failed to generate documentation. Please try again later.',
    })
    expect(setResponseStatusMock).toHaveBeenCalledWith(fakeEvent, 503)
    expect(setResponseHeaderMock).toHaveBeenCalledWith(fakeEvent, 'Cache-Control', 'no-store')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })
})
