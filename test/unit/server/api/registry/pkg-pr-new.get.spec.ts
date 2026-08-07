import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import { createError, type H3Event } from 'h3'

const fetchRawMock = vi.fn()

vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
vi.stubGlobal('createError', createError)
vi.stubGlobal('$fetch', { raw: fetchRawMock })

let queryParams: Record<string, string> = {}
vi.stubGlobal('getQuery', () => queryParams)

const handler = (await import('#server/api/registry/pkg-pr-new.get')).default

const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('pkg-pr-new availability API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryParams = {}
  })

  it('throws 400 when owner/repo are missing', async () => {
    queryParams = { owner: 'vitejs' }
    await expect(handler(fakeEvent)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns hasReleases true when x-has-releases is 1', async () => {
    queryParams = { owner: 'vitejs', repo: 'vite' }
    fetchRawMock.mockResolvedValue({
      headers: {
        get: (name: string) => (name === 'x-has-releases' ? '1' : null),
      },
    })

    const result = await handler(fakeEvent)

    expect(fetchRawMock).toHaveBeenCalledWith('https://pkg.pr.new/~/vitejs/vite', {
      method: 'HEAD',
    })
    expect(result).toEqual({
      hasReleases: true,
      url: 'https://pkg.pr.new/~/vitejs/vite',
    })
  })

  it('returns hasReleases false when x-has-releases is 0', async () => {
    queryParams = { owner: 'owner', repo: 'repo' }
    fetchRawMock.mockResolvedValue({
      headers: {
        get: (name: string) => (name === 'x-has-releases' ? '0' : null),
      },
    })

    const result = await handler(fakeEvent)

    expect(result).toEqual({
      hasReleases: false,
      url: 'https://pkg.pr.new/~/owner/repo',
    })
  })

  it('returns hasReleases false when the HEAD request fails', async () => {
    queryParams = { owner: 'owner', repo: 'repo' }
    fetchRawMock.mockRejectedValue(new Error('network error'))

    const result = await handler(fakeEvent)

    expect(result).toEqual({
      hasReleases: false,
      url: 'https://pkg.pr.new/~/owner/repo',
    })
  })
})
