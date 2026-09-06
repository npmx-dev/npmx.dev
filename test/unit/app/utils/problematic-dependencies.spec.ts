import { describe, expect, it } from 'vitest'
import { getDeprecatedDepInfo } from '~/utils/npm/problematic-dependencies'

describe('getDeprecatedDepInfo', () => {
  it('returns deprecated info from vulnTree if present', () => {
    const vulnTree = {
      package: 'test',
      version: '1.0.0',
      vulnerablePackages: [],
      deprecatedPackages: [
        {
          name: 'dep-pkg',
          version: '1.0.0',
          depth: 'root' as const,
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
