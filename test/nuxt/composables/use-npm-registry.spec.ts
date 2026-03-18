import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockDownloadResponse = {
  downloads: 1234567,
  start: '2024-01-01',
  end: '2024-01-07',
  package: 'vue',
}
describe('usePackageDownloads', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(mockDownloadResponse)
    vi.stubGlobal('$fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should fetch download stats for a package', async () => {
    const { data, status } = usePackageDownloads('vue')

    await vi.waitFor(() => {
      expect(status.value).toBe('success')
    })

    // Check that fetch was called with the correct URL (first argument)
    expect(fetchSpy).toHaveBeenCalled()
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/downloads/point/last-week/vue')
    expect(data.value?.downloads).toBe(1234567)
  })

  it('should use custom period when provided', async () => {
    const { status } = usePackageDownloads('vue', 'last-month')

    await vi.waitFor(() => {
      expect(status.value).toBe('success')
    })

    // Check that fetch was called with the correct URL (first argument)
    expect(fetchSpy).toHaveBeenCalled()
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/downloads/point/last-month/vue')
  })

  it('should encode scoped package names', async () => {
    fetchSpy.mockResolvedValue({ ...mockDownloadResponse, package: '@vue/core' })

    const { status } = usePackageDownloads('@vue/core')

    await vi.waitFor(() => {
      expect(status.value).toBe('success')
    })

    // Check that fetch was called with the correct URL (first argument)
    expect(fetchSpy).toHaveBeenCalled()
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/downloads/point/last-week/@vue%2Fcore')
  })
})
