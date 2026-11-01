import { afterAll, describe, expect, it, vi } from 'vite-plus/test'
import { enrichTimelineVersionTypes } from '#server/utils/package-timeline'

const fetchPackageWithTypesAndFilesMock = vi.fn()
vi.stubGlobal('fetchPackageWithTypesAndFiles', fetchPackageWithTypesAndFilesMock)

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('enrichTimelineVersionTypes', () => {
  it('checks eligible versions with at most five concurrent requests', async () => {
    const releases: Array<() => void> = []
    let activeRequests = 0
    let maxActiveRequests = 0

    fetchPackageWithTypesAndFilesMock.mockImplementation(
      async (packageName: string, version: string) => {
        activeRequests++
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests)

        await new Promise<void>(resolve => releases.push(resolve))
        activeRequests--

        return {
          pkg: { name: packageName, version },
          files: new Set<string>(),
        }
      },
    )

    const versions = Array.from({ length: 8 }, (_, index) => ({
      version: `1.0.${index}`,
    }))
    const enrichment = enrichTimelineVersionTypes('my-pkg', versions, () => true)

    await vi.waitFor(() => expect(fetchPackageWithTypesAndFilesMock).toHaveBeenCalledTimes(5))
    expect(activeRequests).toBe(5)

    releases.splice(0).forEach(release => release())
    await vi.waitFor(() => expect(fetchPackageWithTypesAndFilesMock).toHaveBeenCalledTimes(8))
    expect(activeRequests).toBe(3)

    releases.splice(0).forEach(release => release())

    await enrichment

    expect(fetchPackageWithTypesAndFilesMock).toHaveBeenCalledTimes(8)
    expect(maxActiveRequests).toBe(5)
  })
})
