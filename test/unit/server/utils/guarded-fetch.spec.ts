import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { guardedFetch } from '#server/utils/guarded-fetch'

const fetchMock = vi.fn()

describe('guardedFetch', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses private addresses without fetching', async () => {
    await expect(guardedFetch('http://127.0.0.1/admin')).rejects.toThrow(/Refusing to fetch/)
    await expect(guardedFetch('http://10.0.0.5/xrpc')).rejects.toThrow(/Refusing to fetch/)
    await expect(guardedFetch('http://[::1]/xrpc')).rejects.toThrow(/Refusing to fetch/)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches a public address and passes the request through', async () => {
    const response = new Response('{}', { status: 200 })
    fetchMock.mockResolvedValue(response)
    const init = { method: 'GET' }

    await expect(guardedFetch('http://93.184.215.14/xrpc', init)).resolves.toBe(response)
    expect(fetchMock).toHaveBeenCalledWith('http://93.184.215.14/xrpc', init)
  })
})
