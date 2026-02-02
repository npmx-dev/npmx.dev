import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock Nitro globals before importing the module
vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
const $fetchMock = vi.fn()
vi.stubGlobal('$fetch', $fetchMock)

// Import module under test
const { analyzeDependencyTree } = await import('../../../../server/utils/dependency-analysis')

// Mock the dependency resolver
vi.mock('../../../../server/utils/dependency-resolver', () => ({
  resolveDependencyTree: vi.fn(),
}))

const { resolveDependencyTree } = await import('../../../../server/utils/dependency-resolver')

/**
 * Helper to create mock $fetch that handles the two-step OSV API pattern:
 * 1. Batch query to /v1/querybatch - returns which packages have vulns (just IDs)
 * 2. Individual queries to /v1/query - returns full vuln details for affected packages
 *
 * @param batchResults - Array of results for batch query (vulns array per package, in order)
 * @param detailResults - Map of package key to full vuln details for individual queries
 */
function mockOsvApi(
  batchResults: Array<{ vulns?: Array<{ id: string; modified: string }> }>,
  detailResults: Map<string, { vulns?: Array<Record<string, unknown>> }> = new Map(),
) {
  $fetchMock.mockImplementation(async (url: string, options?: { body?: unknown }) => {
    if (url === 'https://api.osv.dev/v1/querybatch') {
      return { results: batchResults }
    }
    if (url === 'https://api.osv.dev/v1/query') {
      const body = options?.body as { package: { name: string }; version: string }
      const key = `${body.package.name}@${body.version}`
      return detailResults.get(key) || { vulns: [] }
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
}

describe('dependency-analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('analyzeDependencyTree', () => {
    it('returns empty result when no packages have vulnerabilities', async () => {
      const mockResolved = new Map([
        [
          'test-pkg@1.0.0',
          {
            name: 'test-pkg',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['test-pkg@1.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Mock batch API returning no vulnerabilities
      mockOsvApi([{ vulns: [] }])

      const result = await analyzeDependencyTree('test-pkg', '1.0.0')

      expect(result.package).toBe('test-pkg')
      expect(result.version).toBe('1.0.0')
      expect(result.vulnerablePackages).toHaveLength(0)
      expect(result.totalPackages).toBe(1)
      expect(result.failedQueries).toBe(0)
      expect(result.totalCounts).toEqual({ total: 0, critical: 0, high: 0, moderate: 0, low: 0 })
    })

    it('tracks failed queries when OSV batch API fails', async () => {
      const mockResolved = new Map([
        [
          'test-pkg@1.0.0',
          {
            name: 'test-pkg',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['test-pkg@1.0.0'],
          },
        ],
        [
          'dep-a@2.0.0',
          {
            name: 'dep-a',
            version: '2.0.0',
            size: 500,
            optional: false,
            depth: 'direct' as const,
            path: ['test-pkg@1.0.0', 'dep-a@2.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Batch query fails entirely
      $fetchMock.mockRejectedValue(new Error('OSV API error'))

      const result = await analyzeDependencyTree('test-pkg', '1.0.0')

      // When batch fails, all packages are counted as failed
      expect(result.failedQueries).toBe(2)
      expect(result.totalPackages).toBe(2)
    })

    it('correctly counts vulnerabilities by severity', async () => {
      const mockResolved = new Map([
        [
          'vuln-pkg@1.0.0',
          {
            name: 'vuln-pkg',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['vuln-pkg@1.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Mock batch API returns vuln IDs, then detail query returns full info
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-1', modified: '2024-01-01' }] }],
        new Map([
          [
            'vuln-pkg@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-1',
                  summary: 'Critical vuln',
                  database_specific: { severity: 'CRITICAL' },
                },
                { id: 'GHSA-2', summary: 'High vuln', database_specific: { severity: 'HIGH' } },
                {
                  id: 'GHSA-3',
                  summary: 'Moderate vuln',
                  database_specific: { severity: 'MODERATE' },
                },
                { id: 'GHSA-4', summary: 'Low vuln', database_specific: { severity: 'LOW' } },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('vuln-pkg', '1.0.0')

      expect(result.vulnerablePackages).toHaveLength(1)
      expect(result.totalCounts).toEqual({ total: 4, critical: 1, high: 1, moderate: 1, low: 1 })

      const pkg = result.vulnerablePackages[0]
      expect(pkg?.counts.critical).toBe(1)
      expect(pkg?.counts.high).toBe(1)
      expect(pkg?.counts.moderate).toBe(1)
      expect(pkg?.counts.low).toBe(1)
    })

    it('includes dependency path in vulnerable packages', async () => {
      const mockResolved = new Map([
        [
          'root@1.0.0',
          {
            name: 'root',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['root@1.0.0'],
          },
        ],
        [
          'vuln-dep@2.0.0',
          {
            name: 'vuln-dep',
            version: '2.0.0',
            size: 500,
            optional: false,
            depth: 'transitive' as const,
            path: ['root@1.0.0', 'middle@1.5.0', 'vuln-dep@2.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Batch: root has no vulns, vuln-dep has vulns
      mockOsvApi(
        [{ vulns: [] }, { vulns: [{ id: 'GHSA-test', modified: '2024-01-01' }] }],
        new Map([
          [
            'vuln-dep@2.0.0',
            {
              vulns: [
                { id: 'GHSA-test', summary: 'Test vuln', database_specific: { severity: 'HIGH' } },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.vulnerablePackages).toHaveLength(1)
      const vulnPkg = result.vulnerablePackages[0]
      expect(vulnPkg?.path).toEqual(['root@1.0.0', 'middle@1.5.0', 'vuln-dep@2.0.0'])
      expect(vulnPkg?.depth).toBe('transitive')
    })

    it('sorts vulnerable packages by depth then severity', async () => {
      const mockResolved = new Map([
        [
          'root@1.0.0',
          {
            name: 'root',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['root@1.0.0'],
          },
        ],
        [
          'direct-dep@1.0.0',
          {
            name: 'direct-dep',
            version: '1.0.0',
            size: 500,
            optional: false,
            depth: 'direct' as const,
            path: ['root@1.0.0', 'direct-dep@1.0.0'],
          },
        ],
        [
          'transitive-dep@1.0.0',
          {
            name: 'transitive-dep',
            version: '1.0.0',
            size: 300,
            optional: false,
            depth: 'transitive' as const,
            path: ['root@1.0.0', 'direct-dep@1.0.0', 'transitive-dep@1.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // All packages have vulnerabilities
      mockOsvApi(
        [
          { vulns: [{ id: 'GHSA-root', modified: '2024-01-01' }] },
          { vulns: [{ id: 'GHSA-direct', modified: '2024-01-01' }] },
          { vulns: [{ id: 'GHSA-trans', modified: '2024-01-01' }] },
        ],
        new Map([
          [
            'root@1.0.0',
            {
              vulns: [
                { id: 'GHSA-root', summary: 'Root vuln', database_specific: { severity: 'LOW' } },
              ],
            },
          ],
          [
            'direct-dep@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-direct',
                  summary: 'Direct vuln',
                  database_specific: { severity: 'CRITICAL' },
                },
              ],
            },
          ],
          [
            'transitive-dep@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-trans',
                  summary: 'Trans vuln',
                  database_specific: { severity: 'HIGH' },
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.vulnerablePackages).toHaveLength(3)
      // Should be sorted: root first, then direct, then transitive
      expect(result.vulnerablePackages[0]?.name).toBe('root')
      expect(result.vulnerablePackages[1]?.name).toBe('direct-dep')
      expect(result.vulnerablePackages[2]?.name).toBe('transitive-dep')
    })

    it('generates correct vulnerability URLs for GHSA', async () => {
      const mockResolved = new Map([
        [
          'pkg@1.0.0',
          {
            name: 'pkg',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['pkg@1.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-xxxx-yyyy-zzzz', modified: '2024-01-01' }] }],
        new Map([
          [
            'pkg@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-xxxx-yyyy-zzzz',
                  summary: 'Test vuln',
                  database_specific: { severity: 'HIGH' },
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('pkg', '1.0.0')

      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.url).toBe(
        'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
      )
    })

    it('generates correct vulnerability URLs for CVE aliases', async () => {
      const mockResolved = new Map([
        [
          'pkg@1.0.0',
          {
            name: 'pkg',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['pkg@1.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      mockOsvApi(
        [{ vulns: [{ id: 'OSV-2024-001', modified: '2024-01-01' }] }],
        new Map([
          [
            'pkg@1.0.0',
            {
              vulns: [
                {
                  id: 'OSV-2024-001',
                  summary: 'Test vuln',
                  aliases: ['CVE-2024-12345'],
                  database_specific: { severity: 'HIGH' },
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('pkg', '1.0.0')

      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.url).toBe(
        'https://nvd.nist.gov/vuln/detail/CVE-2024-12345',
      )
    })

    it('falls back to OSV URL for other vulnerability IDs', async () => {
      const mockResolved = new Map([
        [
          'pkg@1.0.0',
          {
            name: 'pkg',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['pkg@1.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      mockOsvApi(
        [{ vulns: [{ id: 'PYSEC-2024-001', modified: '2024-01-01' }] }],
        new Map([
          [
            'pkg@1.0.0',
            {
              vulns: [
                {
                  id: 'PYSEC-2024-001',
                  summary: 'Test vuln',
                  database_specific: { severity: 'HIGH' },
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('pkg', '1.0.0')

      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.url).toBe(
        'https://osv.dev/vulnerability/PYSEC-2024-001',
      )
    })

    it('extracts severity from CVSS score when database_specific is missing', async () => {
      const mockResolved = new Map([
        [
          'pkg@1.0.0',
          {
            name: 'pkg',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['pkg@1.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-1', modified: '2024-01-01' }] }],
        new Map([
          [
            'pkg@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-1',
                  summary: 'Critical (9.5)',
                  severity: [{ score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/9.5' }],
                },
                { id: 'GHSA-2', summary: 'High (7.5)', severity: [{ score: '7.5' }] },
                { id: 'GHSA-3', summary: 'Moderate (5.0)', severity: [{ score: '5.0' }] },
                { id: 'GHSA-4', summary: 'Low (2.0)', severity: [{ score: '2.0' }] },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('pkg', '1.0.0')

      expect(result.totalCounts.critical).toBe(1)
      expect(result.totalCounts.high).toBe(1)
      expect(result.totalCounts.moderate).toBe(1)
      expect(result.totalCounts.low).toBe(1)
    })

    it('collects deprecated packages from the dependency tree', async () => {
      const mockResolved = new Map([
        [
          'root@1.0.0',
          {
            name: 'root',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['root@1.0.0'],
          },
        ],
        [
          'deprecated-pkg@2.0.0',
          {
            name: 'deprecated-pkg',
            version: '2.0.0',
            size: 500,
            optional: false,
            depth: 'direct' as const,
            path: ['root@1.0.0', 'deprecated-pkg@2.0.0'],
            deprecated: 'This package is deprecated. Use new-pkg instead.',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)
      mockOsvApi([{ vulns: [] }, { vulns: [] }])

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.deprecatedPackages).toHaveLength(1)
      expect(result.deprecatedPackages[0]).toEqual({
        name: 'deprecated-pkg',
        version: '2.0.0',
        depth: 'direct',
        path: ['root@1.0.0', 'deprecated-pkg@2.0.0'],
        message: 'This package is deprecated. Use new-pkg instead.',
      })
    })

    it('returns empty deprecatedPackages when none are deprecated', async () => {
      const mockResolved = new Map([
        [
          'root@1.0.0',
          {
            name: 'root',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['root@1.0.0'],
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)
      mockOsvApi([{ vulns: [] }])

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.deprecatedPackages).toHaveLength(0)
    })

    it('sorts deprecated packages by depth (root → direct → transitive)', async () => {
      const mockResolved = new Map([
        [
          'root@1.0.0',
          {
            name: 'root',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['root@1.0.0'],
            deprecated: 'Root is deprecated',
          },
        ],
        [
          'transitive-dep@1.0.0',
          {
            name: 'transitive-dep',
            version: '1.0.0',
            size: 300,
            optional: false,
            depth: 'transitive' as const,
            path: ['root@1.0.0', 'direct-dep@1.0.0', 'transitive-dep@1.0.0'],
            deprecated: 'Transitive is deprecated',
          },
        ],
        [
          'direct-dep@1.0.0',
          {
            name: 'direct-dep',
            version: '1.0.0',
            size: 500,
            optional: false,
            depth: 'direct' as const,
            path: ['root@1.0.0', 'direct-dep@1.0.0'],
            deprecated: 'Direct is deprecated',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)
      mockOsvApi([{ vulns: [] }, { vulns: [] }, { vulns: [] }])

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.deprecatedPackages).toHaveLength(3)
      expect(result.deprecatedPackages[0]?.name).toBe('root')
      expect(result.deprecatedPackages[0]?.depth).toBe('root')
      expect(result.deprecatedPackages[1]?.name).toBe('direct-dep')
      expect(result.deprecatedPackages[1]?.depth).toBe('direct')
      expect(result.deprecatedPackages[2]?.name).toBe('transitive-dep')
      expect(result.deprecatedPackages[2]?.depth).toBe('transitive')
    })

    it('returns both vulnerabilities and deprecated packages together', async () => {
      const mockResolved = new Map([
        [
          'root@1.0.0',
          {
            name: 'root',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['root@1.0.0'],
          },
        ],
        [
          'vuln-pkg@1.0.0',
          {
            name: 'vuln-pkg',
            version: '1.0.0',
            size: 500,
            optional: false,
            depth: 'direct' as const,
            path: ['root@1.0.0', 'vuln-pkg@1.0.0'],
          },
        ],
        [
          'deprecated-pkg@1.0.0',
          {
            name: 'deprecated-pkg',
            version: '1.0.0',
            size: 300,
            optional: false,
            depth: 'direct' as const,
            path: ['root@1.0.0', 'deprecated-pkg@1.0.0'],
            deprecated: 'Use something else',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Batch: root and deprecated-pkg have no vulns, vuln-pkg has one
      mockOsvApi(
        [{ vulns: [] }, { vulns: [{ id: 'GHSA-vuln', modified: '2024-01-01' }] }, { vulns: [] }],
        new Map([
          [
            'vuln-pkg@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-vuln',
                  summary: 'A vulnerability',
                  database_specific: { severity: 'HIGH' },
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.vulnerablePackages).toHaveLength(1)
      expect(result.vulnerablePackages[0]?.name).toBe('vuln-pkg')
      expect(result.deprecatedPackages).toHaveLength(1)
      expect(result.deprecatedPackages[0]?.name).toBe('deprecated-pkg')
      expect(result.totalPackages).toBe(3)
    })
  })
})
