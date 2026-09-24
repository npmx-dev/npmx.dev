import { describe, expect, it } from 'vitest'
import { getDeprecatedDepInfo, getVulnerableDepInfo } from '~/utils/npm/problematic-dependencies'
import type { VulnerabilityTreeResult } from '#shared/types/dependency-analysis'

describe('problematic dependencies utils', () => {
  describe('getDeprecatedDepInfo', () => {
    it('returns deprecated info from vulnTree if present', () => {
      const vulnTree: VulnerabilityTreeResult = {
        package: 'test',
        version: '1.0.0',
        vulnerablePackages: [],
        deprecatedPackages: [
          {
            name: 'dep-pkg',
            version: '1.0.0',
            depth: 'root',
            path: ['dep-pkg'],
            message: 'Deprecated in tree',
          },
        ],
        totalPackages: 1,
        failedQueries: 0,
        totalCounts: { total: 0, critical: 0, high: 0, moderate: 0, low: 0 },
      }

      const info = getDeprecatedDepInfo('dep-pkg', vulnTree)
      expect(info).not.toBeNull()
      expect(info?.message).toBe('Deprecated in tree')
    })

    it('uses fallbackDeprecated if vulnTree does not contain deprecation info', () => {
      const info = getDeprecatedDepInfo('dep-pkg', undefined, 'Deprecated message')
      expect(info).not.toBeNull()
      expect(info?.name).toBe('dep-pkg')
      expect(info?.message).toBe('Deprecated message')
    })

    it('returns null if neither vulnTree nor fallbackDeprecated is present', () => {
      const info = getDeprecatedDepInfo('dep-pkg', undefined)
      expect(info).toBeNull()
    })
  })

  describe('getVulnerableDepInfo', () => {
    it('returns vulnerable info from vulnTree if present', () => {
      const vulnTree: VulnerabilityTreeResult = {
        package: 'test',
        version: '1.0.0',
        vulnerablePackages: [
          {
            name: 'vuln-pkg',
            version: '1.0.0',
            depth: 'root',
            path: ['vuln-pkg'],
            vulnerabilities: [],
            counts: { total: 1, critical: 1, high: 0, moderate: 0, low: 0 },
          },
        ],
        deprecatedPackages: [],
        totalPackages: 1,
        failedQueries: 0,
        totalCounts: { total: 1, critical: 1, high: 0, moderate: 0, low: 0 },
      }

      const info = getVulnerableDepInfo('vuln-pkg', vulnTree)
      expect(info).not.toBeNull()
      expect(info?.name).toBe('vuln-pkg')
    })

    it('returns null if package is not in vulnerablePackages', () => {
      const info = getVulnerableDepInfo('safe-pkg', undefined)
      expect(info).toBeNull()
    })
  })

  describe('combined status checks for packages with multiple issues', () => {
    it('correctly identifies both vulnerable and deprecated info for the same package', () => {
      const vulnTree: VulnerabilityTreeResult = {
        package: 'request',
        version: '2.88.2',
        vulnerablePackages: [
          {
            name: 'request',
            version: '2.88.2',
            depth: 'root',
            path: ['request'],
            vulnerabilities: [],
            counts: { total: 1, critical: 0, high: 1, moderate: 0, low: 0 },
          },
        ],
        deprecatedPackages: [
          {
            name: 'request',
            version: '2.88.2',
            depth: 'root',
            path: ['request'],
            message: 'request has been deprecated',
          },
        ],
        totalPackages: 1,
        failedQueries: 0,
        totalCounts: { total: 1, critical: 0, high: 1, moderate: 0, low: 0 },
      }

      const vulnInfo = getVulnerableDepInfo('request', vulnTree)
      const deprInfo = getDeprecatedDepInfo('request', vulnTree, 'request has been deprecated')

      expect(vulnInfo).not.toBeNull()
      expect(deprInfo).not.toBeNull()
    })
  })
})
