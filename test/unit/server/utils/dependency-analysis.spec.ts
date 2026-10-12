import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock Nitro globals before importing the module
vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
const $fetchMock = vi.fn()
vi.stubGlobal('$fetch', $fetchMock)

// Import module under test
const { analyzeDependencyTree } = await import('#server/utils/dependency-analysis')

// Mock the dependency resolver
vi.mock('#server/utils/dependency-resolver', () => ({
  resolveDependencyTree: vi.fn(),
}))

// Mock the Socket client's HTTP layer (covered by socket.spec.ts) while
// keeping pure helpers like strongerReachability real
vi.mock('#server/utils/socket', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  querySocketForTree: vi.fn(),
}))

const { resolveDependencyTree } = await import('#server/utils/dependency-resolver')
const { querySocketForTree } = await import('#server/utils/socket')

type SocketScan = Awaited<ReturnType<typeof querySocketForTree>>

function mockSocketScan(scan: Partial<SocketScan> = {}) {
  vi.mocked(querySocketForTree).mockResolvedValue({
    status: 'unconfigured',
    vulnerabilities: new Map(),
    supplyChainAlerts: new Map(),
    ...scan,
  })
}

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
    // Default: Socket is not configured (no key), contributing no findings
    mockSocketScan()
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
            tarballUrl: 'https://example.com/test-pkg-1.0.0.tgz',
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
      expect(result.sourceStatus).toEqual({ osv: 'ok', socket: 'unconfigured' })
    })

    it('tracks failed queries when OSV batch API fails', async () => {
      // Suppress expected console output from error path
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})

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
            tarballUrl: 'https://example.com/test-pkg-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/dep-a-2.0.0.tgz',
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
      expect(result.sourceStatus).toEqual({ osv: 'failed', socket: 'unconfigured' })
    })

    it('reports partial source status when some detail queries fail', async () => {
      // Suppress expected console output from error path
      vi.spyOn(console, 'warn').mockImplementation(() => {})

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
            tarballUrl: 'https://example.com/test-pkg-1.0.0.tgz',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Batch succeeds and reports a vulnerable package, but the detail query fails
      $fetchMock.mockImplementation(async (url: string) => {
        if (url === 'https://api.osv.dev/v1/querybatch') {
          return { results: [{ vulns: [{ id: 'GHSA-test', modified: '2024-01-01' }] }] }
        }
        throw new Error('OSV detail query failed')
      })

      const result = await analyzeDependencyTree('test-pkg', '1.0.0')

      expect(result.vulnerablePackages).toHaveLength(0)
      expect(result.failedQueries).toBe(1)
      expect(result.sourceStatus).toEqual({ osv: 'partial', socket: 'unconfigured' })
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
            tarballUrl: 'https://example.com/vuln-pkg-1.0.0.tgz',
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
      expect(result.sourceStatus).toEqual({ osv: 'ok', socket: 'unconfigured' })
      // Every vulnerability found via OSV is tagged with its source
      for (const vuln of result.vulnerablePackages[0]!.vulnerabilities) {
        expect(vuln.sources).toEqual(['osv'])
      }

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
            tarballUrl: 'https://example.com/root-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/vuln-dep-2.0.0.tgz',
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
            tarballUrl: 'https://example.com/root-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/direct-dep-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/transitive-dep-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/pkg-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/pkg-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/pkg-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/pkg-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/root-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/deprecated-pkg-2.0.0.tgz',
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
            tarballUrl: 'https://example.com/root-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/root-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/transitive-dep-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/direct-dep-1.0.0.tgz',
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

    it('extracts correct fixedIn version for the current version range', async () => {
      const mockResolved = new Map([
        [
          'minimist@1.0.0',
          {
            name: 'minimist',
            version: '1.0.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['minimist@1.0.0'],
            tarballUrl: 'https://example.com/minimist-1.0.0.tgz',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Mock OSV response with multiple affected ranges (like minimist)
      // Range 1: 0 - 0.2.1, Range 2: 1.0.0 - 1.2.3
      // Version 1.0.0 should match Range 2, so fixedIn should be 1.2.3
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-vh95-rmgr-6w4m', modified: '2024-01-01' }] }],
        new Map([
          [
            'minimist@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-vh95-rmgr-6w4m',
                  summary: 'Prototype Pollution in minimist',
                  database_specific: { severity: 'MODERATE' },
                  affected: [
                    {
                      package: { ecosystem: 'npm', name: 'minimist' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [{ introduced: '0' }, { fixed: '0.2.1' }],
                        },
                      ],
                    },
                    {
                      package: { ecosystem: 'npm', name: 'minimist' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [{ introduced: '1.0.0' }, { fixed: '1.2.3' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('minimist', '1.0.0')

      expect(result.vulnerablePackages).toHaveLength(1)
      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.fixedIn).toBe('1.2.3')
    })

    it('handles shorthand semver in range events (e.g. introduced "13.0")', async () => {
      const mockResolved = new Map([
        [
          'next@14.2.5',
          {
            name: 'next',
            version: '14.2.5',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['next@14.2.5'],
            tarballUrl: 'https://example.com/next-14.2.5.tgz',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Mirrors GHSA-3h52-269p-cp9r: OSV publishes the backport range with a
      // shorthand introduced version ("13.0"), which strict semver rejects
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-3h52-269p-cp9r', modified: '2025-01-01' }] }],
        new Map([
          [
            'next@14.2.5',
            {
              vulns: [
                {
                  id: 'GHSA-3h52-269p-cp9r',
                  summary: 'Information exposure in Next.js dev server',
                  database_specific: { severity: 'LOW' },
                  affected: [
                    {
                      package: { ecosystem: 'npm', name: 'next' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [{ introduced: '15.0.0' }, { fixed: '15.2.2' }],
                        },
                      ],
                    },
                    {
                      package: { ecosystem: 'npm', name: 'next' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [{ introduced: '13.0' }, { fixed: '14.2.30' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('next', '14.2.5')

      expect(result.vulnerablePackages).toHaveLength(1)
      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.fixedIn).toBe('14.2.30')
    })

    it('extracts correct fixedIn for prerelease versions (e.g., 16.0.0-beta.0)', async () => {
      const mockResolved = new Map([
        [
          'next@16.0.0-beta.0',
          {
            name: 'next',
            version: '16.0.0-beta.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['next@16.0.0-beta.0'],
            tarballUrl: 'https://example.com/next-16.0.0-beta.0.tgz',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Mock OSV response with multiple ranges including prerelease
      // Version 16.0.0-beta.0 should NOT match 13.0.0-15.0.8, but SHOULD match 16.0.0-beta.0-16.0.11
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-test', modified: '2024-01-01' }] }],
        new Map([
          [
            'next@16.0.0-beta.0',
            {
              vulns: [
                {
                  id: 'GHSA-test',
                  summary: 'Test vulnerability',
                  database_specific: { severity: 'HIGH' },
                  affected: [
                    {
                      package: { ecosystem: 'npm', name: 'next' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [{ introduced: '13.0.0' }, { fixed: '15.0.8' }],
                        },
                      ],
                    },
                    {
                      package: { ecosystem: 'npm', name: 'next' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [{ introduced: '16.0.0-beta.0' }, { fixed: '16.0.11' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('next', '16.0.0-beta.0')

      expect(result.vulnerablePackages).toHaveLength(1)
      // Should match the 16.x range, not the 13-15 range
      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.fixedIn).toBe('16.0.11')
    })

    it('handles multiple introduced/fixed pairs in a single range', async () => {
      const mockResolved = new Map([
        [
          'example@1.5.0',
          {
            name: 'example',
            version: '1.5.0',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['example@1.5.0'],
            tarballUrl: 'https://example.com/example-1.5.0.tgz',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Single range with multiple introduced/fixed pairs (reintroduced vulnerability)
      // Range: 0-0.2.1, 1.0.0-1.2.3, 1.4.0-1.6.0
      // Version 1.5.0 should match the third interval (1.4.0-1.6.0)
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-multi-range', modified: '2024-01-01' }] }],
        new Map([
          [
            'example@1.5.0',
            {
              vulns: [
                {
                  id: 'GHSA-multi-range',
                  summary: 'Multi-range vulnerability',
                  database_specific: { severity: 'HIGH' },
                  affected: [
                    {
                      package: { ecosystem: 'npm', name: 'example' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [
                            { introduced: '0' },
                            { fixed: '0.2.1' },
                            { introduced: '1.0.0' },
                            { fixed: '1.2.3' },
                            { introduced: '1.4.0' },
                            { fixed: '1.6.0' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('example', '1.5.0')

      expect(result.vulnerablePackages).toHaveLength(1)
      // Should match the third interval and return its fixed version
      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.fixedIn).toBe('1.6.0')
    })

    it('suggests closest fixedIn when multiple ranges match (backport fix preferred)', async () => {
      const mockResolved = new Map([
        [
          'example@3.4.6',
          {
            name: 'example',
            version: '3.4.6',
            size: 1000,
            optional: false,
            depth: 'root' as const,
            path: ['example@3.4.6'],
            tarballUrl: 'https://example.com/example-3.4.6.tgz',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Two affected ranges:
      //   Range 1 (broad): >= 3.4.5-foo.2, < 3.5.9-foo.15 (fix: 3.5.9-foo.15)
      //   Range 2 (narrow backport): >= 3.4.5-foo.2, < 3.4.8 (fix: 3.4.8)
      //
      // Version 3.4.6 falls in BOTH ranges.
      // The broad range is listed first, so the current early-return picks 3.5.9-foo.15.
      // But 3.4.8 is the closer/more appropriate fix for someone on 3.4.x.
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-backport', modified: '2024-01-01' }] }],
        new Map([
          [
            'example@3.4.6',
            {
              vulns: [
                {
                  id: 'GHSA-backport',
                  summary: 'Vulnerability with backported fix',
                  database_specific: { severity: 'HIGH' },
                  affected: [
                    {
                      package: { ecosystem: 'npm', name: 'example' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [{ introduced: '3.4.5-foo.2' }, { fixed: '3.5.9-foo.15' }],
                        },
                      ],
                    },
                    {
                      package: { ecosystem: 'npm', name: 'example' },
                      ranges: [
                        {
                          type: 'SEMVER',
                          events: [{ introduced: '3.4.5-foo.2' }, { fixed: '3.4.8' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('example', '3.4.6')

      expect(result.vulnerablePackages).toHaveLength(1)
      // Should suggest 3.4.8 (the closest fix), not 3.5.9-foo.15
      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.fixedIn).toBe('3.4.8')
    })

    it('returns undefined fixedIn when no matching range has a fixed version', async () => {
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
            tarballUrl: 'https://example.com/pkg-1.0.0.tgz',
          },
        ],
      ])
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)

      // Mock OSV response without affected data
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-no-fix', modified: '2024-01-01' }] }],
        new Map([
          [
            'pkg@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-no-fix',
                  summary: 'Vuln without fix info',
                  database_specific: { severity: 'LOW' },
                  // No affected field
                },
              ],
            },
          ],
        ]),
      )

      const result = await analyzeDependencyTree('pkg', '1.0.0')

      expect(result.vulnerablePackages).toHaveLength(1)
      expect(result.vulnerablePackages[0]?.vulnerabilities[0]?.fixedIn).toBeUndefined()
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
            tarballUrl: 'https://example.com/root-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/vuln-pkg-1.0.0.tgz',
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
            tarballUrl: 'https://example.com/deprecated-pkg-1.0.0.tgz',
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

  describe('Socket merging', () => {
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
          tarballUrl: 'https://example.com/root-1.0.0.tgz',
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
          path: ['root@1.0.0', 'dep-a@2.0.0'],
          tarballUrl: 'https://example.com/dep-a-2.0.0.tgz',
        },
      ],
    ])

    beforeEach(() => {
      vi.mocked(resolveDependencyTree).mockResolvedValue(mockResolved)
    })

    it('merges findings for the same GHSA into one entry tagged with both sources', async () => {
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-shared-0001', modified: '2024-01-01' }] }, { vulns: [] }],
        new Map([
          [
            'root@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-shared-0001',
                  summary: 'Shared vuln',
                  aliases: ['CVE-2024-1111'],
                  database_specific: { severity: 'HIGH' },
                },
              ],
            },
          ],
        ]),
      )

      mockSocketScan({
        status: 'ok',
        vulnerabilities: new Map([
          [
            'root@1.0.0',
            [
              {
                id: 'GHSA-shared-0001',
                ghsaId: 'GHSA-shared-0001',
                summary: 'Shared vuln (socket)',
                severity: 'high' as const,
                reachability: 'reachable' as const,
                url: 'https://github.com/advisories/GHSA-shared-0001',
              },
            ],
          ],
        ]),
      })

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.sourceStatus).toEqual({ osv: 'ok', socket: 'ok' })
      expect(result.vulnerablePackages).toHaveLength(1)
      const vulns = result.vulnerablePackages[0]!.vulnerabilities
      expect(vulns).toHaveLength(1)
      expect(vulns[0]).toMatchObject({
        id: 'GHSA-shared-0001',
        sources: ['osv', 'socket'],
        reachability: 'reachable',
      })
      // deduplicated: counted once
      expect(result.totalCounts).toEqual({ total: 1, critical: 0, high: 1, moderate: 0, low: 0 })
    })

    it('merges by CVE alias when Socket only has a CVE id', async () => {
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-alias-0001', modified: '2024-01-01' }] }, { vulns: [] }],
        new Map([
          [
            'root@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-alias-0001',
                  summary: 'Aliased vuln',
                  aliases: ['CVE-2024-2222'],
                  database_specific: { severity: 'MODERATE' },
                },
              ],
            },
          ],
        ]),
      )

      mockSocketScan({
        status: 'ok',
        vulnerabilities: new Map([
          [
            'root@1.0.0',
            [
              {
                id: 'CVE-2024-2222',
                cveId: 'CVE-2024-2222',
                summary: 'Aliased vuln (socket)',
                severity: 'moderate' as const,
                url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-2222',
              },
            ],
          ],
        ]),
      })

      const result = await analyzeDependencyTree('root', '1.0.0')
      const vulns = result.vulnerablePackages[0]!.vulnerabilities
      expect(vulns).toHaveLength(1)
      expect(vulns[0]!.sources).toEqual(['osv', 'socket'])
    })

    it('adds Socket-only findings as new entries and packages', async () => {
      mockOsvApi([{ vulns: [] }, { vulns: [] }])

      mockSocketScan({
        status: 'ok',
        vulnerabilities: new Map([
          [
            'dep-a@2.0.0',
            [
              {
                id: 'GHSA-sock-0001',
                ghsaId: 'GHSA-sock-0001',
                summary: 'Socket-only vuln',
                severity: 'critical' as const,
                fixedIn: '2.1.0',
                url: 'https://github.com/advisories/GHSA-sock-0001',
              },
            ],
          ],
        ]),
      })

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.vulnerablePackages).toHaveLength(1)
      const pkg = result.vulnerablePackages[0]!
      // depth/path filled in from the resolved tree
      expect(pkg).toMatchObject({ name: 'dep-a', version: '2.0.0', depth: 'direct' })
      expect(pkg.path).toEqual(['root@1.0.0', 'dep-a@2.0.0'])
      expect(pkg.vulnerabilities[0]).toMatchObject({
        id: 'GHSA-sock-0001',
        sources: ['socket'],
        fixedIn: '2.1.0',
      })
      expect(pkg.counts).toEqual({ total: 1, critical: 1, high: 0, moderate: 0, low: 0 })
      expect(result.totalCounts.total).toBe(1)
    })

    it('merges by exact GHSA even when alias groups join distinct advisories', async () => {
      // OSV expands aliases to the whole alias group, so two distinct
      // advisories can cross-list each other's GHSA and CVE ids
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-aaaa-0001', modified: '2024-01-01' }] }, { vulns: [] }],
        new Map([
          [
            'root@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-aaaa-0001',
                  summary: 'Original advisory',
                  aliases: ['CVE-2021-0001', 'CVE-2026-0002', 'GHSA-bbbb-0002'],
                  database_specific: { severity: 'HIGH' },
                },
                {
                  id: 'GHSA-bbbb-0002',
                  summary: 'Fix-bypass advisory',
                  aliases: ['CVE-2021-0001', 'CVE-2026-0002', 'GHSA-aaaa-0001'],
                  database_specific: { severity: 'HIGH' },
                },
              ],
            },
          ],
        ]),
      )

      mockSocketScan({
        status: 'ok',
        vulnerabilities: new Map([
          [
            'root@1.0.0',
            [
              {
                id: 'GHSA-bbbb-0002',
                ghsaId: 'GHSA-bbbb-0002',
                cveId: 'CVE-2026-0002',
                summary: 'Fix-bypass advisory (socket)',
                severity: 'high' as const,
                url: 'https://github.com/advisories/GHSA-bbbb-0002',
              },
            ],
          ],
        ]),
      })

      const result = await analyzeDependencyTree('root', '1.0.0')
      const vulns = result.vulnerablePackages[0]!.vulnerabilities
      expect(vulns).toHaveLength(2)

      const original = vulns.find(vuln => vuln.id === 'GHSA-aaaa-0001')!
      const bypass = vulns.find(vuln => vuln.id === 'GHSA-bbbb-0002')!
      // the Socket finding must land on the advisory it actually names,
      // not on the sibling whose polluted aliases also match its CVE
      expect(bypass.sources).toEqual(['osv', 'socket'])
      expect(bypass.cveId).toBe('CVE-2026-0002')
      expect(original.sources).toEqual(['osv'])
      expect(original.cveId).toBeUndefined()

      // reconciliation strips provably-misattributed aliases (the sibling's
      // primary id, and the CVE the sibling's source paired to itself) and
      // records them so the UI can attribute the bad data
      expect(original.aliases).toEqual(['CVE-2021-0001'])
      expect(original.disputedAliases).toEqual(['CVE-2026-0002', 'GHSA-bbbb-0002'])
      expect(bypass.aliases).toEqual(['CVE-2021-0001', 'CVE-2026-0002'])
      expect(bypass.disputedAliases).toEqual(['GHSA-aaaa-0001'])
    })

    it('never CVE-merges a finding into an entry with a different GHSA id', async () => {
      mockOsvApi(
        [{ vulns: [{ id: 'GHSA-aaaa-0001', modified: '2024-01-01' }] }, { vulns: [] }],
        new Map([
          [
            'root@1.0.0',
            {
              vulns: [
                {
                  id: 'GHSA-aaaa-0001',
                  summary: 'Existing advisory',
                  aliases: ['CVE-2024-0001'],
                  database_specific: { severity: 'HIGH' },
                },
              ],
            },
          ],
        ]),
      )

      mockSocketScan({
        status: 'ok',
        vulnerabilities: new Map([
          [
            'root@1.0.0',
            [
              {
                id: 'GHSA-zzzz-0009',
                ghsaId: 'GHSA-zzzz-0009',
                cveId: 'CVE-2024-0001',
                summary: 'Different advisory sharing a CVE',
                severity: 'moderate' as const,
                url: 'https://github.com/advisories/GHSA-zzzz-0009',
              },
            ],
          ],
        ]),
      })

      const result = await analyzeDependencyTree('root', '1.0.0')
      const vulns = result.vulnerablePackages[0]!.vulnerabilities
      // a finding that names its own GHSA becomes its own entry rather than
      // being folded into a different advisory via a shared CVE
      expect(vulns).toHaveLength(2)
      expect(vulns.find(vuln => vuln.id === 'GHSA-zzzz-0009')!.sources).toEqual(['socket'])
      expect(vulns.find(vuln => vuln.id === 'GHSA-aaaa-0001')!.sources).toEqual(['osv'])
    })

    it('keeps the strongest reachability verdict when duplicate Socket findings merge', async () => {
      mockOsvApi([{ vulns: [] }, { vulns: [] }])

      mockSocketScan({
        status: 'ok',
        vulnerabilities: new Map([
          [
            'root@1.0.0',
            [
              {
                id: 'GHSA-dupe-0001',
                ghsaId: 'GHSA-dupe-0001',
                summary: 'Duplicated advisory',
                severity: 'high' as const,
                reachability: 'reachable' as const,
                url: 'https://github.com/advisories/GHSA-dupe-0001',
              },
              {
                id: 'GHSA-dupe-0001',
                ghsaId: 'GHSA-dupe-0001',
                summary: 'Duplicated advisory (second alert)',
                severity: 'high' as const,
                reachability: 'unreachable' as const,
                url: 'https://github.com/advisories/GHSA-dupe-0001',
              },
            ],
          ],
        ]),
      })

      const result = await analyzeDependencyTree('root', '1.0.0')
      const vulns = result.vulnerablePackages[0]!.vulnerabilities
      expect(vulns).toHaveLength(1)
      // 'reachable' must not be downgraded by the later 'unreachable' verdict
      expect(vulns[0]!.reachability).toBe('reachable')
    })

    it('ignores Socket findings for packages outside the resolved tree', async () => {
      mockOsvApi([{ vulns: [] }, { vulns: [] }])

      mockSocketScan({
        status: 'ok',
        vulnerabilities: new Map([
          [
            'unknown-pkg@9.9.9',
            [
              {
                id: 'GHSA-unknown-0001',
                summary: 'Not in tree',
                severity: 'high' as const,
                url: 'https://example.com',
              },
            ],
          ],
        ]),
      })

      const result = await analyzeDependencyTree('root', '1.0.0')
      expect(result.vulnerablePackages).toHaveLength(0)
    })

    it('builds supply-chain packages with depth and path from the tree', async () => {
      mockOsvApi([{ vulns: [] }, { vulns: [] }])

      mockSocketScan({
        status: 'ok',
        supplyChainAlerts: new Map([
          [
            'dep-a@2.0.0',
            [
              {
                type: 'installScripts' as const,
                severity: 'low' as const,
                url: 'https://socket.dev/npm/package/dep-a',
                sources: ['socket' as const],
              },
              {
                type: 'malware' as const,
                severity: 'critical' as const,
                url: 'https://socket.dev/npm/package/dep-a',
                sources: ['socket' as const],
              },
            ],
          ],
        ]),
      })

      const result = await analyzeDependencyTree('root', '1.0.0')

      expect(result.supplyChainPackages).toHaveLength(1)
      const pkg = result.supplyChainPackages[0]!
      expect(pkg).toMatchObject({ name: 'dep-a', version: '2.0.0', depth: 'direct' })
      // alerts sorted by severity (critical first)
      expect(pkg.alerts.map(alert => alert.type)).toEqual(['malware', 'installScripts'])
    })
  })
})
