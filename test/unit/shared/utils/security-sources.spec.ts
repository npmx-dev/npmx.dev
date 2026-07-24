import { describe, expect, it } from 'vitest'
import type {
  PackageVulnerabilityInfo,
  VulnerabilityTreeResult,
} from '#shared/types/dependency-analysis'
import {
  filterVulnerabilityTreeBySources,
  hasTransientSourceFailure,
  noEnabledSecuritySourceHasData,
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
    deprecatedPackages: [],
    totalPackages: 10,
    failedQueries: 0,
    totalCounts,
    sourceStatus: { osv: 'ok' },
  }
}

describe('noEnabledSecuritySourceHasData', () => {
  it('is false when an enabled source succeeded', () => {
    expect(noEnabledSecuritySourceHasData({ osv: 'ok' }, { osv: true })).toBe(false)
    expect(noEnabledSecuritySourceHasData({ osv: 'partial' }, { osv: true })).toBe(false)
  })

  it('is true when no enabled source produced data', () => {
    expect(noEnabledSecuritySourceHasData({ osv: 'failed' }, { osv: true })).toBe(true)
  })

  it('is false for an empty status record or no enabled sources', () => {
    expect(noEnabledSecuritySourceHasData({}, { osv: true })).toBe(false)
    // disabled sources are not consulted; the no-sources-enabled state is
    // handled separately by the warning banner
    expect(noEnabledSecuritySourceHasData({ osv: 'failed' }, { osv: false })).toBe(false)
  })
})

describe('hasTransientSourceFailure', () => {
  it('is true when a source failed', () => {
    expect(hasTransientSourceFailure({ osv: 'failed' })).toBe(true)
  })

  it('is false for complete results', () => {
    expect(hasTransientSourceFailure({ osv: 'ok' })).toBe(false)
    expect(hasTransientSourceFailure({ osv: 'partial' })).toBe(false)
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
})
