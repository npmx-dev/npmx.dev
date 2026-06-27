import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadPackageTarball } from '~/utils/package-download'

describe('downloadPackageTarball', () => {
  let originalCreateObjectURL!: typeof URL.createObjectURL
  let originalRevokeObjectURL!: typeof URL.revokeObjectURL

  let clickSpy: ReturnType<typeof vi.spyOn>
  let appendSpy: ReturnType<typeof vi.spyOn>
  let removeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    appendSpy = vi.spyOn(document.body, 'appendChild')
    removeSpy = vi.spyOn(document.body, 'removeChild')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    })
  })

  it('downloads fetched tarballs through an object URL and revokes it afterwards', async () => {
    const blob = new Blob(['package'])
    const createObjectURL = vi.fn(() => 'blob:download')
    const revokeObjectURL = vi.fn()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => blob,
      })),
    )
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    })

    await downloadPackageTarball('@scope/pkg', {
      version: '1.2.3',
      dist: {
        tarball: 'https://registry.npmjs.org/@scope/pkg/-/pkg-1.2.3.tgz',
      },
    })

    const anchor = appendSpy.mock.calls[0]?.[0]

    expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/@scope/pkg/-/pkg-1.2.3.tgz')
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(anchor).toBeInstanceOf(HTMLAnchorElement)
    expect((anchor as HTMLAnchorElement).href).toBe('blob:download')
    expect((anchor as HTMLAnchorElement).download).toBe('@scope__pkg-1.2.3.tgz')
    expect(removeSpy).toHaveBeenCalledWith(anchor)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(document.body.contains(anchor as Node)).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download')
  })

  it('falls back to the remote tarball URL when fetching fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })

    await downloadPackageTarball('vue', {
      version: '3.5.0',
      dist: {
        tarball: 'https://registry.npmjs.org/vue/-/vue-3.5.0.tgz',
      },
    })

    const anchor = appendSpy.mock.calls[0]?.[0]

    expect(anchor).toBeInstanceOf(HTMLAnchorElement)
    expect((anchor as HTMLAnchorElement).href).toBe(
      'https://registry.npmjs.org/vue/-/vue-3.5.0.tgz',
    )
    expect(removeSpy).toHaveBeenCalledWith(anchor)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
  })

  it('returns early when the version has no tarball URL', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await downloadPackageTarball('vue', {
      version: '3.5.0',
      dist: {},
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(appendSpy).not.toHaveBeenCalled()
    expect(removeSpy).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
