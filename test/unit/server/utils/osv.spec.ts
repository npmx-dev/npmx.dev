import { describe, expect, it, vi, beforeEach } from 'vitest'

const $fetchMock = vi.fn()
vi.stubGlobal('$fetch', $fetchMock)

const { fetchOsvVulnerabilityCount } = await import('#server/utils/osv')

describe('osv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchOsvVulnerabilityCount', () => {
    it('returns the number of vulnerabilities', async () => {
      $fetchMock.mockResolvedValue({
        vulns: [
          { id: 'GHSA-aaaa-bbbb-cccc', modified: '2024-01-01' },
          { id: 'GHSA-dddd-eeee-ffff', modified: '2024-01-02' },
        ],
      })

      await expect(fetchOsvVulnerabilityCount('test-pkg', '1.0.0')).resolves.toBe(2)
    })

    it('returns 0 when no vulnerabilities are found', async () => {
      $fetchMock.mockResolvedValue({})

      await expect(fetchOsvVulnerabilityCount('test-pkg', '1.0.0')).resolves.toBe(0)
    })

    it('returns null (not 0) when the query fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      $fetchMock.mockRejectedValue(new Error('OSV API error'))

      await expect(fetchOsvVulnerabilityCount('test-pkg', '1.0.0')).resolves.toBeNull()
    })
  })
})
