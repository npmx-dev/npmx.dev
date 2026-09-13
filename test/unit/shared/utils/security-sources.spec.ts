import { describe, expect, it } from 'vitest'
import type {
  PackageVulnerabilityInfo,
  VulnerabilityTreeResult,
} from '#shared/types/dependency-analysis'
import {
  filterVulnerabilityTreeBySources,
  hasTransientSourceFailure,
  noEnabledSecuritySourceHasData,
  securitySourceHasData,
  selectPreviewVulnerabilities,
} from '#shared/utils/security-sources'

function makeVuln(
  id: string,
  severity: PackageVulnerabilityInfo['vulnerabilities'][number]['severity'],
  sources: PackageVulnerabilityInfo['vulnerabilities'][number]['sources'],
): PackageVulnerabilityInfo['vulnerabilities'][number] {
  return {
    id,
    summary: `Summary for ${id}`,
    severity,
    aliases: [],
    url: `https://osv.dev/vulnerability/${id}`,
    sources,
  }
}

function makeTree(vulnerablePackages: PackageVulnerabilityInfo[]): VulnerabilityTreeResult {
  const totalCounts = { total: 0, critical: 0, high: 0, moderate: 0, low: 0 }
  for (const pkg of vulnerablePackages) {
    totalCounts.total += pkg.counts.total
    totalCounts.critical += pkg.counts.critical
    totalCounts.high += pkg.counts.high
    totalCounts.moderate += pkg.counts.moderate
    totalCounts.low += pkg.counts.low
  }
  return {
    package: 'root-pkg',
    version: '1.0.0',
    vulnerablePackages,
    supplyChainPackages: [],
    deprecatedPackages: [],
    totalPackages: 10,
    failedQueries: 0,
    totalCounts,
    sourceStatus: { osv: 'ok', socket: 'unconfigured' },
  }
}

describe('noEnabledSecuritySourceHasData', () => {
  const allEnabled = { osv: true, socket: true }

  it('is false when an enabled source succeeded', () => {
    expect(noEnabledSecuritySourceHasData({ osv: 'ok', socket: 'unconfigured' }, allEnabled)).toBe(
      false,
    )
    expect(noEnabledSecuritySourceHasData({ osv: 'partial', socket: 'failed' }, allEnabled)).toBe(
      false,
    )
  })

  it('is true when no enabled source produced data', () => {
    expect(noEnabledSecuritySourceHasData({ osv: 'failed', socket: 'failed' }, allEnabled)).toBe(
      true,
    )
    // unconfigured/unavailable sources carry no data either
    expect(
      noEnabledSecuritySourceHasData({ osv: 'failed', socket: 'unconfigured' }, allEnabled),
    ).toBe(true)
    expect(
      noEnabledSecuritySourceHasData({ osv: 'failed', socket: 'unavailable' }, allEnabled),
    ).toBe(true)
  })

  it("ignores an 'ok' status from a disabled source", () => {
    // the user's only enabled source failed; the disabled source's success
    // must not mask the failure
    expect(
      noEnabledSecuritySourceHasData({ osv: 'failed', socket: 'ok' }, { osv: true, socket: false }),
    ).toBe(true)
    expect(
      noEnabledSecuritySourceHasData(
        { osv: 'ok', socket: 'unavailable' },
        { osv: false, socket: true },
      ),
    ).toBe(true)
  })

  it('is false for an empty status record or no enabled sources', () => {
    expect(noEnabledSecuritySourceHasData({}, allEnabled)).toBe(false)
    expect(noEnabledSecuritySourceHasData({ osv: 'failed' }, { osv: false, socket: false })).toBe(
      false,
    )
  })
})

describe('hasTransientSourceFailure', () => {
  it('is true for failed, unavailable, or partial (degraded) sources', () => {
    expect(hasTransientSourceFailure({ osv: 'ok', socket: 'unavailable' })).toBe(true)
    expect(hasTransientSourceFailure({ osv: 'failed', socket: 'ok' })).toBe(true)
    // a partial scan is degraded, so it must not be cached for the full hour
    expect(hasTransientSourceFailure({ osv: 'partial', socket: 'unconfigured' })).toBe(true)
  })

  it('is false for complete or stably-unconfigured results', () => {
    expect(hasTransientSourceFailure({ osv: 'ok', socket: 'ok' })).toBe(false)
    expect(hasTransientSourceFailure({ osv: 'ok', socket: 'unconfigured' })).toBe(false)
  })
})

describe('securitySourceHasData', () => {
  it('is true only when the source succeeded fully or partially', () => {
    expect(securitySourceHasData({ socket: 'ok' }, 'socket')).toBe(true)
    expect(securitySourceHasData({ socket: 'partial' }, 'socket')).toBe(true)
  })

  it('is false when the source is unconfigured, unavailable, failed, or absent', () => {
    expect(securitySourceHasData({ socket: 'unconfigured' }, 'socket')).toBe(false)
    expect(securitySourceHasData({ socket: 'unavailable' }, 'socket')).toBe(false)
    expect(securitySourceHasData({ socket: 'failed' }, 'socket')).toBe(false)
    expect(securitySourceHasData({ osv: 'ok' }, 'socket')).toBe(false)
  })
})

describe('filterVulnerabilityTreeBySources', () => {
  const pkg: PackageVulnerabilityInfo = {
    name: 'vuln-pkg',
    version: '2.0.0',
    depth: 'direct',
    path: ['root-pkg@1.0.0', 'vuln-pkg@2.0.0'],
    vulnerabilities: [
      makeVuln('GHSA-aaaa-aaaa-aaaa', 'critical', ['osv']),
      makeVuln('GHSA-bbbb-bbbb-bbbb', 'low', ['osv']),
    ],
    counts: { total: 2, critical: 1, high: 0, moderate: 0, low: 1 },
  }

  it('passes the tree through unchanged when all sources are enabled', () => {
    const tree = makeTree([pkg])
    const filtered = filterVulnerabilityTreeBySources(tree, { osv: true })
    expect(filtered.vulnerablePackages).toHaveLength(1)
    expect(filtered.vulnerablePackages[0]).toBe(pkg)
    expect(filtered.totalCounts).toEqual(tree.totalCounts)
  })

  it('removes all findings when every source is disabled', () => {
    const tree = makeTree([pkg])
    const filtered = filterVulnerabilityTreeBySources(tree, { osv: false })
    expect(filtered.vulnerablePackages).toHaveLength(0)
    expect(filtered.totalCounts).toEqual({ total: 0, critical: 0, high: 0, moderate: 0, low: 0 })
  })

  it('recomputes counts when only some findings remain', () => {
    const mixedPkg: PackageVulnerabilityInfo = {
      ...pkg,
      vulnerabilities: [
        makeVuln('GHSA-cccc-cccc-cccc', 'critical', ['osv']),
        makeVuln('UNKNOWN-1', 'unknown', ['osv']),
      ],
      counts: { total: 2, critical: 1, high: 0, moderate: 0, low: 0 },
    }
    const tree = makeTree([mixedPkg])
    const filtered = filterVulnerabilityTreeBySources(tree, { osv: true })
    // unknown severities count toward the total but no severity bucket
    expect(filtered.totalCounts).toEqual({ total: 2, critical: 1, high: 0, moderate: 0, low: 0 })
  })

  it('preserves deprecated packages and scan metadata', () => {
    const tree = makeTree([pkg])
    tree.deprecatedPackages = [
      {
        name: 'old-pkg',
        version: '0.1.0',
        depth: 'transitive',
        path: [],
        message: 'use something else',
      },
    ]
    const filtered = filterVulnerabilityTreeBySources(tree, { osv: false })
    expect(filtered.deprecatedPackages).toEqual(tree.deprecatedPackages)
    expect(filtered.totalPackages).toBe(tree.totalPackages)
    expect(filtered.sourceStatus).toEqual(tree.sourceStatus)
  })

  it('keeps multi-source findings when any of their sources is enabled', () => {
    const mergedPkg: PackageVulnerabilityInfo = {
      ...pkg,
      vulnerabilities: [
        makeVuln('GHSA-both-0001', 'high', ['osv', 'socket']),
        makeVuln('GHSA-osv-0002', 'low', ['osv']),
      ],
      counts: { total: 2, critical: 0, high: 1, moderate: 0, low: 1 },
    }
    const tree = makeTree([mergedPkg])

    const socketOnly = filterVulnerabilityTreeBySources(tree, { osv: false, socket: true })
    expect(socketOnly.vulnerablePackages).toHaveLength(1)
    expect(socketOnly.vulnerablePackages[0]!.vulnerabilities.map(v => v.id)).toEqual([
      'GHSA-both-0001',
    ])
    expect(socketOnly.totalCounts).toEqual({ total: 1, critical: 0, high: 1, moderate: 0, low: 0 })
  })

  it('filters supply-chain alerts by source', () => {
    const tree = makeTree([])
    tree.supplyChainPackages = [
      {
        name: 'sketchy-pkg',
        version: '1.0.0',
        depth: 'direct',
        path: [],
        alerts: [
          {
            type: 'malware',
            severity: 'critical',
            url: 'https://socket.dev/npm/package/sketchy-pkg',
            sources: ['socket'],
          },
        ],
      },
    ]

    const enabled = filterVulnerabilityTreeBySources(tree, { osv: true, socket: true })
    expect(enabled.supplyChainPackages).toHaveLength(1)

    const disabled = filterVulnerabilityTreeBySources(tree, { osv: true, socket: false })
    expect(disabled.supplyChainPackages).toHaveLength(0)
  })
})

describe('selectPreviewVulnerabilities', () => {
  it('returns the list unchanged when it fits the limit', () => {
    const vulns = [makeVuln('GHSA-a', 'high', ['osv']), makeVuln('GHSA-b', 'low', ['socket'])]
    expect(selectPreviewVulnerabilities(vulns, 2)).toEqual(vulns)
  })

  it('guarantees a representative for a source below the fold', () => {
    const vulns = [
      makeVuln('GHSA-a', 'critical', ['osv']),
      makeVuln('GHSA-b', 'high', ['osv']),
      makeVuln('GHSA-c', 'low', ['socket']),
    ]
    // a plain slice would show two OSV rows and hide Socket entirely
    expect(selectPreviewVulnerabilities(vulns, 2).map(vuln => vuln.id)).toEqual([
      'GHSA-a',
      'GHSA-c',
    ])
  })

  it('lets a merged finding represent all of its sources', () => {
    const vulns = [
      makeVuln('GHSA-a', 'critical', ['osv', 'socket']),
      makeVuln('GHSA-b', 'high', ['osv']),
      makeVuln('GHSA-c', 'low', ['socket']),
    ]
    // GHSA-a already covers both sources, so the remaining slot goes to
    // the next finding by severity
    expect(selectPreviewVulnerabilities(vulns, 2).map(vuln => vuln.id)).toEqual([
      'GHSA-a',
      'GHSA-b',
    ])
  })

  it('preserves severity order in the preview', () => {
    const vulns = [
      makeVuln('GHSA-a', 'critical', ['socket']),
      makeVuln('GHSA-b', 'high', ['osv']),
      makeVuln('GHSA-c', 'low', ['osv']),
    ]
    expect(selectPreviewVulnerabilities(vulns, 2).map(vuln => vuln.id)).toEqual([
      'GHSA-a',
      'GHSA-b',
    ])
  })
})
