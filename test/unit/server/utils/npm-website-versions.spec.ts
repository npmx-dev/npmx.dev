import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

vi.stubGlobal('encodePackageName', (name: string) => {
  if (name.startsWith('@')) return `@${encodeURIComponent(name.slice(1))}`
  return encodeURIComponent(name)
})
vi.stubGlobal('createError', createError)

const { fetchNpmVersionDownloadsFromApi } = await import('#server/utils/npm-website-versions')

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('fetchNpmVersionDownloadsFromApi', () => {
  it('encodes scoped package names in npm API request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        downloads: {
          '1.0.0': 123,
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchNpmVersionDownloadsFromApi('@nuxt/kit')

    expect(fetchMock).toHaveBeenCalledWith('https://api.npmjs.org/versions/@nuxt%2Fkit/last-week')
    expect(result).toEqual([
      {
        version: '1.0.0',
        downloads: 123,
      },
    ])
  })

  it('throws a not-found error when npm API returns 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchNpmVersionDownloadsFromApi('missing-package')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Package not found',
    })
  })
})
