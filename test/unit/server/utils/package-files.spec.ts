import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPackageFile,
  fetchPackageMetadata,
  readPackageResponseText,
  type PackageResponseTooLargeError,
} from '#server/utils/package-files'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPackageFile', () => {
  it('uses jsDelivr without a fallback when the primary request succeeds', async () => {
    const response = new Response('content')
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPackageFile('pkg', '1.0.0', 'dist/index.js')

    expect(result).toEqual({ provider: 'jsdelivr', response })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.jsdelivr.net/npm/pkg@1.0.0/dist/index.js', {
      signal: undefined,
    })
  })

  it('falls back to UNPKG after a jsDelivr 403 and reuses the abort signal', async () => {
    const primary = new Response('Package size exceeded', { status: 403 })
    const fallback = new Response('content')
    const fetchMock = vi.fn().mockResolvedValueOnce(primary).mockResolvedValueOnce(fallback)
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal

    const result = await fetchPackageFile('@scope/pkg', '1.0.0', 'file name.js', signal)

    expect(result).toEqual({ provider: 'unpkg', response: fallback })
    expect(primary.bodyUsed).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://cdn.jsdelivr.net/npm/@scope/pkg@1.0.0/file%20name.js',
      { signal },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://unpkg.com/@scope/pkg@1.0.0/file%20name.js',
      { signal },
    )
  })

  it('preserves a primary 404 without trying the fallback', async () => {
    const response = new Response(null, { status: 404 })
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPackageFile('pkg', '1.0.0', 'missing.js')

    expect(result).toEqual({ provider: 'jsdelivr', response })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('propagates an aborted primary request without trying the fallback', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    const fetchMock = vi.fn().mockRejectedValue(abortError)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPackageFile('pkg', '1.0.0', 'index.js')).rejects.toBe(abortError)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('propagates an aborted fallback request', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 403,
        body: { cancel: vi.fn().mockResolvedValue(undefined) },
      })
      .mockRejectedValueOnce(abortError)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPackageFile('pkg', '1.0.0', 'index.js')).rejects.toBe(abortError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('continues to the fallback when discarding the primary body fails', async () => {
    const fallback = new Response('content')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 403,
        body: { cancel: vi.fn().mockRejectedValue(new Error('cancel failed')) },
      })
      .mockResolvedValueOnce(fallback)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPackageFile('pkg', '1.0.0', 'index.js')).resolves.toEqual({
      provider: 'unpkg',
      response: fallback,
    })
  })
})

describe('fetchPackageMetadata', () => {
  it('uses the metadata endpoints for the same fallback behavior', async () => {
    const primary = new Response(null, { status: 403 })
    const fallback = new Response('{}')
    const fetchMock = vi.fn().mockResolvedValueOnce(primary).mockResolvedValueOnce(fallback)
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPackageMetadata('pkg', '1.0.0')

    expect(result).toEqual({ provider: 'unpkg', response: fallback })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://data.jsdelivr.com/v1/packages/npm/pkg@1.0.0',
      { signal: undefined },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://unpkg.com/pkg@1.0.0/?meta', {
      signal: undefined,
    })
  })
})

describe('readPackageResponseText', () => {
  it('reads a response within the byte limit', async () => {
    await expect(readPackageResponseText(new Response('hello'), 5)).resolves.toBe('hello')
  })

  it('stops a streamed response that exceeds the byte limit without a content-length header', async () => {
    const response = new Response('sixsix')

    await expect(readPackageResponseText(response, 5)).rejects.toMatchObject({
      name: 'PackageResponseTooLargeError',
      sizeBytes: 6,
    } satisfies Partial<PackageResponseTooLargeError>)
  })

  it('rejects a declared oversized response before reading its body', async () => {
    const response = new Response('small', { headers: { 'content-length': '10' } })

    await expect(readPackageResponseText(response, 5)).rejects.toMatchObject({
      sizeBytes: 10,
    } satisfies Partial<PackageResponseTooLargeError>)
    expect(response.bodyUsed).toBe(true)
  })
})
