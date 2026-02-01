import { describe, expect, it } from 'vitest'
import {
  buildTaggedVersionRows,
  buildVersionToTagsMap,
  filterExcludedTags,
  getPrereleaseChannel,
  getVersionGroupKey,
  getVersionGroupLabel,
  isSameVersionGroup,
  parseVersion,
  sortTags,
} from '../../../../app/utils/versions'

describe('parseVersion', () => {
  it('parses stable versions', () => {
    expect(parseVersion('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: '',
    })
  })

  it('parses prerelease versions', () => {
    expect(parseVersion('1.0.0-beta.1')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: 'beta.1',
    })
  })

  it('handles invalid versions gracefully', () => {
    expect(parseVersion('invalid')).toEqual({
      major: 0,
      minor: 0,
      patch: 0,
      prerelease: '',
    })
  })

  it('parses TypeScript-style versions', () => {
    // TypeScript uses versions like 5.8.0-beta, 5.8.0-rc
    expect(parseVersion('5.8.0-beta')).toEqual({
      major: 5,
      minor: 8,
      patch: 0,
      prerelease: 'beta',
    })
  })

  it('parses Next.js canary versions', () => {
    // Next.js uses versions like 15.3.0-canary.1
    expect(parseVersion('15.3.0-canary.1')).toEqual({
      major: 15,
      minor: 3,
      patch: 0,
      prerelease: 'canary.1',
    })
  })
})

describe('getPrereleaseChannel', () => {
  it('returns empty string for stable versions', () => {
    expect(getPrereleaseChannel('1.0.0')).toBe('')
  })

  it('extracts beta channel', () => {
    expect(getPrereleaseChannel('1.0.0-beta.1')).toBe('beta')
  })

  it('extracts alpha channel', () => {
    expect(getPrereleaseChannel('1.0.0-alpha.1')).toBe('alpha')
  })

  it('extracts rc channel', () => {
    expect(getPrereleaseChannel('4.0.0-rc.0')).toBe('rc')
  })

  it('extracts canary channel (Next.js style)', () => {
    expect(getPrereleaseChannel('15.3.0-canary.1')).toBe('canary')
  })

  it('handles versions with just channel name (TypeScript style)', () => {
    expect(getPrereleaseChannel('5.8.0-beta')).toBe('beta')
  })
})

describe('sortTags', () => {
  it('puts latest first', () => {
    expect(sortTags(['beta', 'latest', 'alpha'])).toEqual(['latest', 'alpha', 'beta'])
  })

  it('sorts alphabetically when no latest', () => {
    expect(sortTags(['beta', 'canary', 'alpha'])).toEqual(['alpha', 'beta', 'canary'])
  })

  it('handles single tag', () => {
    expect(sortTags(['latest'])).toEqual(['latest'])
  })

  it('handles empty array', () => {
    expect(sortTags([])).toEqual([])
  })

  it('does not mutate original array', () => {
    const original = ['beta', 'latest']
    sortTags(original)
    expect(original).toEqual(['beta', 'latest'])
  })
})

describe('buildVersionToTagsMap', () => {
  it('builds map from simple dist-tags', () => {
    const distTags = {
      latest: '1.0.0',
      beta: '2.0.0-beta.1',
    }
    const map = buildVersionToTagsMap(distTags)
    expect(map.get('1.0.0')).toEqual(['latest'])
    expect(map.get('2.0.0-beta.1')).toEqual(['beta'])
  })

  it('groups multiple tags pointing to same version', () => {
    const distTags = {
      latest: '1.0.0',
      stable: '1.0.0',
      lts: '1.0.0',
    }
    const map = buildVersionToTagsMap(distTags)
    // Should be sorted with latest first, then alphabetically
    expect(map.get('1.0.0')).toEqual(['latest', 'lts', 'stable'])
  })

  it('handles Nuxt dist-tags', () => {
    // Real Nuxt dist-tags structure
    const distTags = {
      '1x': '1.4.5',
      '2x': '2.18.1',
      'alpha': '4.0.0-alpha.4',
      'rc': '4.0.0-rc.0',
      '3x': '3.21.0',
      'latest': '4.3.0',
    }
    const map = buildVersionToTagsMap(distTags)
    expect(map.get('4.3.0')).toEqual(['latest'])
    expect(map.get('3.21.0')).toEqual(['3x'])
    expect(map.size).toBe(6)
  })

  it('handles TypeScript dist-tags with overlapping versions', () => {
    // Simulating a scenario where latest and next point to same version
    const distTags = {
      latest: '5.8.3',
      next: '5.8.3',
      beta: '5.9.0-beta',
      rc: '5.9.0-rc',
    }
    const map = buildVersionToTagsMap(distTags)
    expect(map.get('5.8.3')).toEqual(['latest', 'next'])
    expect(map.get('5.9.0-beta')).toEqual(['beta'])
  })

  it('handles Next.js dist-tags', () => {
    // Real Next.js dist-tags structure
    const distTags = {
      'latest': '15.2.4',
      'canary': '15.3.0-canary.49',
      'rc': '15.2.0-rc.2',
      'experimental-react': '0.0.0-experimental-react',
    }
    const map = buildVersionToTagsMap(distTags)
    expect(map.get('15.2.4')).toEqual(['latest'])
    expect(map.get('15.3.0-canary.49')).toEqual(['canary'])
  })

  it('handles Vue dist-tags', () => {
    // Vue uses v3-latest, etc.
    const distTags = {
      'latest': '3.5.13',
      'next': '3.5.13',
      'v2-latest': '2.7.16',
      'csp': '1.0.28-csp',
    }
    const map = buildVersionToTagsMap(distTags)
    // latest and next both point to 3.5.13
    expect(map.get('3.5.13')).toEqual(['latest', 'next'])
    expect(map.get('2.7.16')).toEqual(['v2-latest'])
  })

  it('handles React dist-tags', () => {
    const distTags = {
      latest: '19.1.0',
      next: '19.1.0',
      canary: '19.1.0-canary-xyz',
      experimental: '0.0.0-experimental-xyz',
      rc: '19.0.0-rc.1',
    }
    const map = buildVersionToTagsMap(distTags)
    // latest and next both point to same version
    expect(map.get('19.1.0')).toEqual(['latest', 'next'])
  })
})

describe('buildTaggedVersionRows', () => {
  it('builds rows sorted by version descending', () => {
    const distTags = {
      latest: '2.0.0',
      beta: '3.0.0-beta.1',
      legacy: '1.0.0',
    }
    const rows = buildTaggedVersionRows(distTags)
    expect(rows.map(r => r.version)).toEqual(['3.0.0-beta.1', '2.0.0', '1.0.0'])
  })

  it('deduplicates versions with multiple tags', () => {
    const distTags = {
      latest: '1.0.0',
      stable: '1.0.0',
      beta: '2.0.0-beta.1',
    }
    const rows = buildTaggedVersionRows(distTags)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      id: 'version:2.0.0-beta.1',
      primaryTag: 'beta',
      tags: ['beta'],
      version: '2.0.0-beta.1',
    })
    expect(rows[1]).toEqual({
      id: 'version:1.0.0',
      primaryTag: 'latest',
      tags: ['latest', 'stable'],
      version: '1.0.0',
    })
  })

  it('uses latest as primary tag when present', () => {
    const distTags = {
      stable: '1.0.0',
      latest: '1.0.0',
      lts: '1.0.0',
    }
    const rows = buildTaggedVersionRows(distTags)
    expect(rows[0]!.primaryTag).toBe('latest')
    expect(rows[0]!.tags).toEqual(['latest', 'lts', 'stable'])
  })

  it('handles Vue scenario with latest and next on same version', () => {
    const distTags = {
      'latest': '3.5.13',
      'next': '3.5.13',
      'v2-latest': '2.7.16',
    }
    const rows = buildTaggedVersionRows(distTags)
    expect(rows).toHaveLength(2)
    // 3.5.13 should come first (higher version)
    expect(rows[0]).toEqual({
      id: 'version:3.5.13',
      primaryTag: 'latest',
      tags: ['latest', 'next'],
      version: '3.5.13',
    })
  })

  it('handles Nuxt scenario', () => {
    const distTags = {
      '1x': '1.4.5',
      '2x': '2.18.1',
      'alpha': '4.0.0-alpha.4',
      'rc': '4.0.0-rc.0',
      '3x': '3.21.0',
      'latest': '4.3.0',
    }
    const rows = buildTaggedVersionRows(distTags)
    expect(rows).toHaveLength(6)
    // Check order: 4.3.0 > 4.0.0-rc.0 > 4.0.0-alpha.4 > 3.21.0 > 2.18.1 > 1.4.5
    expect(rows.map(r => r.version)).toEqual([
      '4.3.0',
      '4.0.0-rc.0',
      '4.0.0-alpha.4',
      '3.21.0',
      '2.18.1',
      '1.4.5',
    ])
    expect(rows[0]!.tags).toEqual(['latest'])
  })
})

describe('filterExcludedTags', () => {
  it('filters out excluded tags', () => {
    expect(filterExcludedTags(['latest', 'beta', 'rc'], ['latest'])).toEqual(['beta', 'rc'])
  })

  it('filters multiple excluded tags', () => {
    expect(filterExcludedTags(['latest', 'next', 'beta'], ['latest', 'next'])).toEqual(['beta'])
  })

  it('returns all tags if none excluded', () => {
    expect(filterExcludedTags(['latest', 'beta'], [])).toEqual(['latest', 'beta'])
  })

  it('returns empty if all excluded', () => {
    expect(filterExcludedTags(['latest'], ['latest'])).toEqual([])
  })

  it('handles non-matching exclusions', () => {
    expect(filterExcludedTags(['beta', 'rc'], ['latest'])).toEqual(['beta', 'rc'])
  })
})

describe('getVersionGroupKey', () => {
  it('groups 1.x+ versions by major only', () => {
    expect(getVersionGroupKey('1.0.0')).toBe('1')
    expect(getVersionGroupKey('1.5.3')).toBe('1')
    expect(getVersionGroupKey('2.0.0')).toBe('2')
    expect(getVersionGroupKey('10.5.2')).toBe('10')
  })

  it('groups 0.x versions by major.minor', () => {
    expect(getVersionGroupKey('0.1.0')).toBe('0.1')
    expect(getVersionGroupKey('0.1.5')).toBe('0.1')
    expect(getVersionGroupKey('0.9.0')).toBe('0.9')
    expect(getVersionGroupKey('0.9.3')).toBe('0.9')
    expect(getVersionGroupKey('0.10.0')).toBe('0.10')
    expect(getVersionGroupKey('0.10.5')).toBe('0.10')
  })

  it('handles prerelease versions', () => {
    expect(getVersionGroupKey('1.0.0-beta.1')).toBe('1')
    expect(getVersionGroupKey('0.5.0-alpha.1')).toBe('0.5')
  })
})

describe('getVersionGroupLabel', () => {
  it('formats 1.x+ group keys', () => {
    expect(getVersionGroupLabel('1')).toBe('1.x')
    expect(getVersionGroupLabel('2')).toBe('2.x')
    expect(getVersionGroupLabel('10')).toBe('10.x')
  })

  it('formats 0.x group keys', () => {
    expect(getVersionGroupLabel('0.1')).toBe('0.1.x')
    expect(getVersionGroupLabel('0.9')).toBe('0.9.x')
    expect(getVersionGroupLabel('0.10')).toBe('0.10.x')
  })
})

describe('isSameVersionGroup', () => {
  it('groups 1.x+ versions by major', () => {
    expect(isSameVersionGroup('1.0.0', '1.5.3')).toBe(true)
    expect(isSameVersionGroup('1.0.0', '1.99.99')).toBe(true)
    expect(isSameVersionGroup('2.0.0', '2.1.0')).toBe(true)
  })

  it('separates different major versions', () => {
    expect(isSameVersionGroup('1.0.0', '2.0.0')).toBe(false)
    expect(isSameVersionGroup('1.5.3', '2.0.0')).toBe(false)
  })

  it('groups 0.x versions by major.minor', () => {
    expect(isSameVersionGroup('0.1.0', '0.1.5')).toBe(true)
    expect(isSameVersionGroup('0.9.0', '0.9.3')).toBe(true)
    expect(isSameVersionGroup('0.10.0', '0.10.5')).toBe(true)
  })

  it('separates different 0.x minor versions', () => {
    // This is the key test: 0.9.x should NOT be grouped with 0.10.x
    expect(isSameVersionGroup('0.9.0', '0.10.0')).toBe(false)
    expect(isSameVersionGroup('0.9.3', '0.10.5')).toBe(false)
    expect(isSameVersionGroup('0.1.0', '0.2.0')).toBe(false)
  })

  it('separates 0.x from 1.x', () => {
    expect(isSameVersionGroup('0.9.0', '1.0.0')).toBe(false)
    expect(isSameVersionGroup('0.99.99', '1.0.0')).toBe(false)
  })

  it('handles prerelease versions in 1.x+', () => {
    expect(isSameVersionGroup('1.0.0-beta.1', '1.0.0')).toBe(true)
    expect(isSameVersionGroup('1.0.0-alpha.1', '1.5.0')).toBe(true)
  })

  it('handles prerelease versions in 0.x', () => {
    expect(isSameVersionGroup('0.5.0-beta.1', '0.5.0')).toBe(true)
    expect(isSameVersionGroup('0.5.0-alpha.1', '0.5.3')).toBe(true)
    expect(isSameVersionGroup('0.5.0-beta.1', '0.6.0')).toBe(false)
  })
})
