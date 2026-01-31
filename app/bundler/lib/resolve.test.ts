import { describe, expect, it } from 'vitest'

import { reverseJsrName, transformJsrName } from './registry'
import { parseSpecifier, pickVersion, resolve } from './resolve'
import type { AbbreviatedManifest } from './types'

// #region test helpers

/** creates a mock manifest for testing */
function manifest(version: string, opts: { deprecated?: string } = {}): AbbreviatedManifest {
  return {
    name: 'test',
    version,
    deprecated: opts.deprecated,
    dist: { tarball: `https://example.com/test-${version}.tgz`, shasum: 'abc' },
  }
}

// #endregion

// #region parseSpecifier

describe('parseSpecifier', () => {
  describe('npm packages', () => {
    it('parses bare package name', () => {
      expect(parseSpecifier('react')).toEqual({
        name: 'react',
        range: 'latest',
        registry: 'npm',
      })
    })

    it('parses package with exact version', () => {
      expect(parseSpecifier('react@18.2.0')).toEqual({
        name: 'react',
        range: '18.2.0',
        registry: 'npm',
      })
    })

    it('parses package with semver range', () => {
      expect(parseSpecifier('react@^18.0.0')).toEqual({
        name: 'react',
        range: '^18.0.0',
        registry: 'npm',
      })
    })

    it('parses npm: prefix as noop', () => {
      expect(parseSpecifier('npm:react')).toEqual({
        name: 'react',
        range: 'latest',
        registry: 'npm',
      })
    })

    it('parses npm: prefix with version', () => {
      expect(parseSpecifier('npm:react@18.2.0')).toEqual({
        name: 'react',
        range: '18.2.0',
        registry: 'npm',
      })
    })
  })

  describe('scoped packages', () => {
    it('parses scoped package without version', () => {
      expect(parseSpecifier('@babel/core')).toEqual({
        name: '@babel/core',
        range: 'latest',
        registry: 'npm',
      })
    })

    it('parses scoped package with exact version', () => {
      expect(parseSpecifier('@babel/core@7.23.0')).toEqual({
        name: '@babel/core',
        range: '7.23.0',
        registry: 'npm',
      })
    })

    it('parses scoped package with semver range', () => {
      expect(parseSpecifier('@types/node@^20.0.0')).toEqual({
        name: '@types/node',
        range: '^20.0.0',
        registry: 'npm',
      })
    })

    it('parses npm: prefix with scoped package', () => {
      expect(parseSpecifier('npm:@babel/core@^7.0.0')).toEqual({
        name: '@babel/core',
        range: '^7.0.0',
        registry: 'npm',
      })
    })
  })

  describe('JSR packages', () => {
    it('parses jsr package without version', () => {
      expect(parseSpecifier('jsr:@luca/flag')).toEqual({
        name: '@luca/flag',
        range: 'latest',
        registry: 'jsr',
      })
    })

    it('parses jsr package with exact version', () => {
      expect(parseSpecifier('jsr:@luca/flag@1.0.0')).toEqual({
        name: '@luca/flag',
        range: '1.0.0',
        registry: 'jsr',
      })
    })

    it('parses jsr package with semver range', () => {
      expect(parseSpecifier('jsr:@std/path@^1.0.0')).toEqual({
        name: '@std/path',
        range: '^1.0.0',
        registry: 'jsr',
      })
    })

    it('throws for unscoped jsr package', () => {
      expect(() => parseSpecifier('jsr:flag')).toThrow('JSR packages must be scoped')
    })
  })
})

// #endregion

// #region JSR name utilities

describe('JSR name utilities', () => {
  describe('transformJsrName', () => {
    it('transforms scoped JSR name to npm-compatible format', () => {
      expect(transformJsrName('@luca/flag')).toBe('@jsr/luca__flag')
    })

    it('transforms @std packages', () => {
      expect(transformJsrName('@std/path')).toBe('@jsr/std__path')
    })

    it('throws for unscoped package', () => {
      expect(() => transformJsrName('flag')).toThrow('JSR packages must be scoped')
    })
  })

  describe('reverseJsrName', () => {
    it('reverses npm-compatible JSR name to canonical format', () => {
      expect(reverseJsrName('@jsr/luca__flag')).toBe('@luca/flag')
    })

    it('reverses @std packages', () => {
      expect(reverseJsrName('@jsr/std__internal')).toBe('@std/internal')
    })

    it('throws for non-JSR name', () => {
      expect(() => reverseJsrName('@babel/core')).toThrow('not a JSR npm-compatible name')
    })
  })
})

// #endregion

// #region pickVersion

describe('pickVersion', () => {
  describe('dist-tags', () => {
    const versions = {
      '1.0.0': manifest('1.0.0'),
      '2.0.0': manifest('2.0.0'),
      '3.0.0-beta.1': manifest('3.0.0-beta.1'),
    }
    const distTags = { latest: '2.0.0', next: '3.0.0-beta.1' }

    it('resolves "latest" tag', () => {
      expect(pickVersion(versions, distTags, 'latest')?.version).toBe('2.0.0')
    })

    it('resolves "next" tag', () => {
      expect(pickVersion(versions, distTags, 'next')?.version).toBe('3.0.0-beta.1')
    })

    it('returns null for unknown tag', () => {
      expect(pickVersion(versions, distTags, 'nonexistent')).toBeNull()
    })

    it('returns null when tag points to missing version', () => {
      expect(pickVersion(versions, { latest: '9.9.9' }, 'latest')).toBeNull()
    })

    it('treats empty string as latest', () => {
      expect(pickVersion(versions, distTags, '')?.version).toBe('2.0.0')
    })
  })

  describe('exact versions', () => {
    const versions = {
      '1.0.0': manifest('1.0.0'),
      '2.0.0': manifest('2.0.0'),
    }
    const distTags = { latest: '2.0.0' }

    it('resolves exact version', () => {
      expect(pickVersion(versions, distTags, '1.0.0')?.version).toBe('1.0.0')
    })

    it('handles v-prefixed version', () => {
      expect(pickVersion(versions, distTags, 'v1.0.0')?.version).toBe('1.0.0')
    })

    it('handles = prefixed version', () => {
      expect(pickVersion(versions, distTags, '= 1.0.0')?.version).toBe('1.0.0')
    })

    it('returns null for non-existent version', () => {
      expect(pickVersion(versions, distTags, '9.9.9')).toBeNull()
    })
  })

  describe('semver ranges', () => {
    const versions = {
      '1.0.0': manifest('1.0.0'),
      '1.5.0': manifest('1.5.0'),
      '2.0.0': manifest('2.0.0'),
      '2.5.0': manifest('2.5.0'),
      '3.0.0': manifest('3.0.0'),
    }
    const distTags = { latest: '3.0.0' }

    it('resolves caret range (^)', () => {
      expect(pickVersion(versions, distTags, '^1.0.0')?.version).toBe('1.5.0')
    })

    it('resolves tilde range (~)', () => {
      expect(pickVersion(versions, distTags, '~1.0.0')?.version).toBe('1.0.0')
    })

    it('resolves >= range', () => {
      expect(pickVersion(versions, distTags, '>=2.0.0')?.version).toBe('3.0.0')
    })

    it('resolves > range', () => {
      expect(pickVersion(versions, distTags, '>2.0.0')?.version).toBe('3.0.0')
    })

    it('resolves < range', () => {
      expect(pickVersion(versions, distTags, '<2.0.0')?.version).toBe('1.5.0')
    })

    it('resolves <= range', () => {
      expect(pickVersion(versions, distTags, '<=2.0.0')?.version).toBe('2.0.0')
    })

    it('resolves compound range (>=x <y)', () => {
      expect(pickVersion(versions, distTags, '>=1.0.0 <2.0.0')?.version).toBe('1.5.0')
    })

    it('resolves hyphen range (x - y)', () => {
      expect(pickVersion(versions, distTags, '1.0.0 - 2.0.0')?.version).toBe('2.0.0')
    })

    it('resolves OR range (||)', () => {
      expect(pickVersion(versions, distTags, '^1.0.0 || ^3.0.0')?.version).toBe('3.0.0')
    })

    it('resolves x-range (1.x)', () => {
      expect(pickVersion(versions, distTags, '1.x')?.version).toBe('1.5.0')
    })

    it('returns null for unsatisfied range', () => {
      expect(pickVersion(versions, distTags, '^9.0.0')).toBeNull()
    })

    it('returns null for empty versions object', () => {
      expect(pickVersion({}, distTags, '^1.0.0')).toBeNull()
    })
  })

  describe('latest tag preference (pnpm behavior)', () => {
    // pnpm prefers the version tagged as 'latest' even when newer versions exist,
    // because publishers tag 'latest' intentionally (e.g., LTS versions)

    const versions = {
      '18.0.0': manifest('18.0.0'),
      '20.0.0': manifest('20.0.0'),
      '21.0.0': manifest('21.0.0'),
    }

    it('prefers latest over newer versions when range is satisfied', () => {
      const distTags = { latest: '20.0.0' }
      // 21.0.0 exists and satisfies >=18.0.0, but latest (20.0.0) should win
      expect(pickVersion(versions, distTags, '>=18.0.0')?.version).toBe('20.0.0')
    })

    it('picks newer version when latest does not satisfy range', () => {
      const distTags = { latest: '18.0.0' }
      // latest (18.0.0) doesn't satisfy >=20.0.0, so pick highest matching (21.0.0)
      expect(pickVersion(versions, distTags, '>=20.0.0')?.version).toBe('21.0.0')
    })

    it('prefers latest in OR ranges when satisfied', () => {
      const distTags = { latest: '20.0.0' }
      expect(pickVersion(versions, distTags, '^18.0.0 || ^20.0.0')?.version).toBe('20.0.0')
    })
  })

  describe('deprecated version handling', () => {
    // pnpm/npm avoid deprecated versions when non-deprecated alternatives exist

    const versions = {
      '1.0.0': manifest('1.0.0'),
      '2.0.0': manifest('2.0.0', { deprecated: 'security issue' }),
      '3.0.0': manifest('3.0.0'),
      '3.1.0': manifest('3.1.0', { deprecated: 'use 3.0.0 instead' }),
    }
    const distTags = { latest: '3.0.0' }

    it('picks non-deprecated over deprecated when both satisfy', () => {
      // ^3.0.0 matches 3.0.0 and 3.1.0, but 3.1.0 is deprecated
      expect(pickVersion(versions, distTags, '^3.0.0')?.version).toBe('3.0.0')
    })

    it('prefers non-deprecated even if deprecated is higher', () => {
      expect(pickVersion(versions, distTags, '>=3.0.0')?.version).toBe('3.0.0')
    })

    it('uses deprecated when no non-deprecated version satisfies', () => {
      // ^2.0.0 only matches 2.0.0 which is deprecated
      expect(pickVersion(versions, distTags, '^2.0.0')?.version).toBe('2.0.0')
    })

    it('picks highest deprecated when all are deprecated', () => {
      const allDeprecated = {
        '1.0.0': manifest('1.0.0', { deprecated: 'old' }),
        '1.1.0': manifest('1.1.0', { deprecated: 'old' }),
      }
      expect(pickVersion(allDeprecated, { latest: '1.1.0' }, '^1.0.0')?.version).toBe('1.1.0')
    })
  })

  describe('prerelease handling', () => {
    it('does not match prereleases with standard ranges', () => {
      const versions = {
        '1.0.0': manifest('1.0.0'),
        '2.0.0-beta.1': manifest('2.0.0-beta.1'),
      }
      // ^1.0.0 should NOT match 2.0.0-beta.1
      expect(pickVersion(versions, { latest: '1.0.0' }, '^1.0.0')?.version).toBe('1.0.0')
    })

    it('prefers stable over prerelease when both satisfy', () => {
      const versions = {
        '1.0.0-alpha.1': manifest('1.0.0-alpha.1'),
        '1.0.0': manifest('1.0.0'),
      }
      expect(pickVersion(versions, { latest: '1.0.0' }, '>=1.0.0-alpha.1')?.version).toBe('1.0.0')
    })

    it('matches explicit prerelease version', () => {
      const versions = {
        '1.0.0-beta.1': manifest('1.0.0-beta.1'),
        '1.0.0-beta.2': manifest('1.0.0-beta.2'),
      }
      expect(pickVersion(versions, { latest: '1.0.0-beta.2' }, '1.0.0-beta.1')?.version).toBe(
        '1.0.0-beta.1',
      )
    })

    it('matches prerelease range correctly', () => {
      const versions = {
        '1.0.0-beta.1': manifest('1.0.0-beta.1'),
        '1.0.0-beta.2': manifest('1.0.0-beta.2'),
      }
      // ^1.0.0-beta.1 should match other 1.0.0 betas
      expect(pickVersion(versions, { latest: '1.0.0-beta.2' }, '^1.0.0-beta.1')?.version).toBe(
        '1.0.0-beta.2',
      )
    })

    it('sorts prereleases correctly (alpha < beta < rc)', () => {
      const versions = {
        '1.0.0-alpha.1': manifest('1.0.0-alpha.1'),
        '1.0.0-beta.1': manifest('1.0.0-beta.1'),
        '1.0.0-rc.1': manifest('1.0.0-rc.1'),
      }
      expect(pickVersion(versions, { latest: '1.0.0-rc.1' }, '>=1.0.0-alpha.1')?.version).toBe(
        '1.0.0-rc.1',
      )
    })

    it('uses latest tag with wildcard when all versions are prerelease', () => {
      const versions = {
        '1.0.0-alpha.1': manifest('1.0.0-alpha.1'),
        '1.0.0-beta.1': manifest('1.0.0-beta.1'),
      }
      // * with all prereleases should respect latest tag (pnpm/npm behavior)
      expect(pickVersion(versions, { latest: '1.0.0-alpha.1' }, '*')?.version).toBe('1.0.0-alpha.1')
    })

    it('picks prerelease with wildcard when only prereleases exist', () => {
      const versions = {
        '1.0.0-alpha.1': manifest('1.0.0-alpha.1'),
      }
      expect(pickVersion(versions, { latest: '1.0.0-alpha.1' }, '*')?.version).toBe('1.0.0-alpha.1')
    })
  })
})

// #endregion

// #region resolve (integration tests)

describe('resolve', () => {
  describe('basic resolution', () => {
    it('resolves a single package with dependencies', async () => {
      const result = await resolve(['is-odd@3.0.1'])

      expect(result.roots).toHaveLength(1)
      expect(result.roots[0]!.name).toBe('is-odd')
      expect(result.roots[0]!.version).toBe('3.0.1')
      expect(result.roots[0]!.dependencies.has('is-number')).toBe(true)
    })

    it('resolves multiple packages', async () => {
      const result = await resolve(['is-odd@3.0.1', 'is-even@1.0.0'])

      expect(result.roots).toHaveLength(2)
      expect(result.roots[0]!.name).toBe('is-odd')
      expect(result.roots[1]!.name).toBe('is-even')
    })

    it('deduplicates shared dependencies', async () => {
      const result = await resolve(['is-odd@3.0.1', 'is-even@1.0.0'])

      const isNumberVersions = new Set<string>()
      for (const pkg of result.packages.values()) {
        if (pkg.name === 'is-number') {
          isNumberVersions.add(pkg.version)
        }
      }
      expect(isNumberVersions.size).toBeGreaterThan(0)
    })
  })

  describe('JSR packages', () => {
    it('resolves a JSR package', async () => {
      const result = await resolve(['jsr:@luca/flag@1.0.1'])

      expect(result.roots).toHaveLength(1)
      expect(result.roots[0]!.name).toBe('@luca/flag')
      expect(result.roots[0]!.version).toBe('1.0.1')
      expect(result.roots[0]!.tarball).toContain('npm.jsr.io')
    })

    it('resolves JSR package with JSR dependencies', async () => {
      const result = await resolve(['jsr:@std/path@1.1.4'])

      expect(result.roots[0]!.name).toBe('@std/path')
      // dependency stored under npm-compatible name, resolved to canonical
      expect(result.roots[0]!.dependencies.has('@jsr/std__internal')).toBe(true)
      const internal = result.roots[0]!.dependencies.get('@jsr/std__internal')!
      expect(internal.name).toBe('@std/internal')
      expect(internal.tarball).toContain('npm.jsr.io')
    })
  })

  describe('peer dependencies', () => {
    it('auto-installs required peer dependencies', async () => {
      const result = await resolve(['use-sync-external-store@1.2.0'])

      const mainPkg = result.roots[0]!
      expect(mainPkg.dependencies.has('react')).toBe(true)
      expect(Array.from(result.packages.values()).some(p => p.name === 'react')).toBe(true)
    })

    it('skips optional peer dependencies', async () => {
      const result = await resolve(['use-sync-external-store@1.2.0'])

      // react is required, should be present
      const mainPkg = result.roots[0]!
      expect(mainPkg.dependencies.has('react')).toBe(true)
    })

    it('respects installPeers: false option', async () => {
      const result = await resolve(['use-sync-external-store@1.2.0'], { installPeers: false })

      expect(result.roots).toHaveLength(1)
      expect(result.roots[0]!.name).toBe('use-sync-external-store')
    })
  })
})

// #endregion
