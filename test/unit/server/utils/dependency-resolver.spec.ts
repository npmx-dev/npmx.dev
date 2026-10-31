import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AbbreviatedPackument, AbbreviatedPackumentVersion } from '#shared/types'

// Mock Nitro globals before importing the module
vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
vi.stubGlobal('$fetch', vi.fn())

const mockAbbreviatedPackument = vi.fn<(name: string) => Promise<AbbreviatedPackument | null>>()
vi.stubGlobal('fetchNpmPackageAbbreviated', mockAbbreviatedPackument)

const mockVersionLibc = vi.fn<(name: string, version: string) => Promise<string[] | undefined>>()
vi.stubGlobal('fetchNpmPackageVersionLibc', mockVersionLibc)

const { TARGET_PLATFORM, matchesPlatform, resolveVersion, resolveDependencyTree } =
  await import('#server/utils/dependency-resolver')

/**
 * Helper to build a minimal abbreviated packument for mocking.
 */
function makePackument(
  name: string,
  versions: Array<{
    version: string
    deps?: Record<string, string>
    optionalDeps?: Record<string, string>
    os?: string[]
    cpu?: string[]
    libc?: string[]
    unpackedSize?: number
    deprecated?: string
  }>,
): AbbreviatedPackument {
  const versionsMap: Record<string, AbbreviatedPackumentVersion> = {}
  for (const v of versions) {
    versionsMap[v.version] = {
      version: v.version,
      dependencies: v.deps,
      optionalDependencies: v.optionalDeps,
      os: v.os,
      cpu: v.cpu,
      libc: v.libc,
      dist: { unpackedSize: v.unpackedSize },
      ...(v.deprecated ? { deprecated: v.deprecated } : {}),
    }
  }
  return { name, versions: versionsMap }
}

describe('dependency-resolver', () => {
  describe('TARGET_PLATFORM', () => {
    it('is configured for linux-x64-glibc', () => {
      expect(TARGET_PLATFORM).toEqual({
        os: 'linux',
        cpu: 'x64',
        libc: 'glibc',
      })
    })
  })

  describe('matchesPlatform', () => {
    it('returns true for packages without platform restrictions', () => {
      const version = {}
      expect(matchesPlatform(version)).toBe(true)
    })

    it('returns true when os includes linux', () => {
      const version = { os: ['linux', 'darwin'] }
      expect(matchesPlatform(version)).toBe(true)
    })

    it('returns false when os excludes linux', () => {
      const version = { os: ['darwin', 'win32'] }
      expect(matchesPlatform(version)).toBe(false)
    })

    it('handles negated os values (!linux)', () => {
      const version = { os: ['!win32'] }
      expect(matchesPlatform(version)).toBe(true)

      const excluded = { os: ['!linux'] }
      expect(matchesPlatform(excluded)).toBe(false)
    })

    it('returns true when cpu includes x64', () => {
      const version = { cpu: ['x64', 'arm64'] }
      expect(matchesPlatform(version)).toBe(true)
    })

    it('returns false when cpu excludes x64', () => {
      const version = { cpu: ['arm64', 'arm'] }
      expect(matchesPlatform(version)).toBe(false)
    })

    it('handles negated cpu values (!x64)', () => {
      const version = { cpu: ['!arm64'] }
      expect(matchesPlatform(version)).toBe(true)

      const excluded = { cpu: ['!x64'] }
      expect(matchesPlatform(excluded)).toBe(false)
    })

    it('returns true when libc includes glibc', () => {
      const version = { libc: ['glibc'] }
      expect(matchesPlatform(version)).toBe(true)
    })

    it('returns false when libc is musl only', () => {
      const version = { libc: ['musl'] }
      expect(matchesPlatform(version)).toBe(false)
    })

    it('handles negated libc values (!glibc)', () => {
      const version = { libc: ['!musl'] }
      expect(matchesPlatform(version)).toBe(true)

      const excluded = { libc: ['!glibc'] }
      expect(matchesPlatform(excluded)).toBe(false)
    })

    it('requires all platform constraints to match', () => {
      const version = {
        os: ['linux'],
        cpu: ['arm64'], // doesn't match x64
      }
      expect(matchesPlatform(version)).toBe(false)
    })

    it('ignores empty arrays', () => {
      const version = { os: [], cpu: [], libc: [] }
      expect(matchesPlatform(version)).toBe(true)
    })
  })

  describe('resolveVersion', () => {
    const versions = ['1.0.0', '1.0.1', '1.1.0', '2.0.0', '2.0.0-beta.1', '3.0.0']

    it('returns exact version if it exists', () => {
      expect(resolveVersion('1.0.0', versions)).toBe('1.0.0')
      expect(resolveVersion('2.0.0', versions)).toBe('2.0.0')
    })

    it('returns null for exact version that does not exist', () => {
      expect(resolveVersion('1.0.2', versions)).toBe(null)
    })

    it('resolves semver ranges', () => {
      expect(resolveVersion('^1.0.0', versions)).toBe('1.1.0')
      expect(resolveVersion('~1.0.0', versions)).toBe('1.0.1')
      expect(resolveVersion('>=2.0.0', versions)).toBe('3.0.0')
      expect(resolveVersion('<2.0.0', versions)).toBe('1.1.0')
    })

    it('resolves * to latest stable', () => {
      expect(resolveVersion('*', versions)).toBe('3.0.0')
    })

    it('handles npm: protocol aliases', () => {
      expect(resolveVersion('npm:other-pkg@^1.0.0', versions)).toBe('1.1.0')
      expect(resolveVersion('npm:@scope/pkg@2.0.0', versions)).toBe('2.0.0')
    })

    it('returns null for invalid npm: protocol', () => {
      expect(resolveVersion('npm:', versions)).toBe(null)
      expect(resolveVersion('npm:pkg', versions)).toBe(null)
    })

    it('returns null for URLs', () => {
      expect(resolveVersion('https://github.com/user/repo', versions)).toBe(null)
      expect(resolveVersion('http://example.com/pkg.tgz', versions)).toBe(null)
      expect(resolveVersion('git://github.com/user/repo.git', versions)).toBe(null)
      expect(resolveVersion('git+https://github.com/user/repo.git', versions)).toBe(null)
    })

    it('returns null for file: protocol', () => {
      expect(resolveVersion('file:../local-pkg', versions)).toBe(null)
    })

    it('returns null for GitHub shorthand (contains /)', () => {
      expect(resolveVersion('user/repo', versions)).toBe(null)
      expect(resolveVersion('user/repo#branch', versions)).toBe(null)
    })

    it('handles prerelease versions when explicitly requested', () => {
      // Exact prerelease version match
      expect(resolveVersion('2.0.0-beta.1', versions)).toBe('2.0.0-beta.1')
      // Range with prerelease - semver correctly prefers stable 2.0.0 over 2.0.0-beta.1
      expect(resolveVersion('^2.0.0-beta.0', versions)).toBe('2.0.0')
    })
  })

  describe('resolveDependencyTree', () => {
    beforeEach(() => {
      mockAbbreviatedPackument.mockReset()
      mockVersionLibc.mockReset()
      mockVersionLibc.mockResolvedValue(undefined)
    })

    it('resolves a single package with no dependencies', async () => {
      mockAbbreviatedPackument.mockResolvedValue(
        makePackument('root', [{ version: '1.0.0', unpackedSize: 5000 }]),
      )

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.size).toBe(1)
      const pkg = result.get('root@1.0.0')
      expect(pkg).toEqual({
        name: 'root',
        version: '1.0.0',
        size: 5000,
        tarballUrl: '',
        optional: false,
      })
    })

    it('resolves direct dependencies', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            {
              version: '1.0.0',
              deps: { 'dep-a': '^1.0.0', 'dep-b': '^2.0.0' },
              unpackedSize: 1000,
            },
          ])
        if (name === 'dep-a')
          return makePackument('dep-a', [{ version: '1.2.0', unpackedSize: 2000 }])
        if (name === 'dep-b')
          return makePackument('dep-b', [{ version: '2.1.0', unpackedSize: 3000 }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.size).toBe(3)
      expect(result.get('root@1.0.0')).toMatchObject({ name: 'root', version: '1.0.0' })
      expect(result.get('dep-a@1.2.0')).toMatchObject({
        name: 'dep-a',
        version: '1.2.0',
        size: 2000,
        optional: false,
      })
      expect(result.get('dep-b@2.1.0')).toMatchObject({
        name: 'dep-b',
        version: '2.1.0',
        size: 3000,
        optional: false,
      })
    })

    it('resolves transitive dependencies (A → B → C)', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'a') return makePackument('a', [{ version: '1.0.0', deps: { b: '^1.0.0' } }])
        if (name === 'b') return makePackument('b', [{ version: '1.0.0', deps: { c: '^1.0.0' } }])
        if (name === 'c') return makePackument('c', [{ version: '1.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('a', '1.0.0')

      expect(result.size).toBe(3)
      expect(result.has('a@1.0.0')).toBe(true)
      expect(result.has('b@1.0.0')).toBe(true)
      expect(result.has('c@1.0.0')).toBe(true)
    })

    it('handles circular dependencies without infinite loop', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'a') return makePackument('a', [{ version: '1.0.0', deps: { b: '^1.0.0' } }])
        if (name === 'b') return makePackument('b', [{ version: '1.0.0', deps: { a: '^1.0.0' } }])
        return null
      })

      const result = await resolveDependencyTree('a', '1.0.0')

      expect(result.size).toBe(2)
      expect(result.has('a@1.0.0')).toBe(true)
      expect(result.has('b@1.0.0')).toBe(true)
    })

    it('marks optional dependencies with optional: true', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            { version: '1.0.0', optionalDeps: { 'opt-dep': '^1.0.0' } },
          ])
        if (name === 'opt-dep')
          return makePackument('opt-dep', [{ version: '1.0.0', unpackedSize: 500 }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.size).toBe(2)
      expect(result.get('opt-dep@1.0.0')).toMatchObject({ optional: true })
    })

    it('skips dependencies that do not match the target platform', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            { version: '1.0.0', deps: { 'darwin-only': '^1.0.0', 'linux-ok': '^1.0.0' } },
          ])
        if (name === 'darwin-only')
          return makePackument('darwin-only', [{ version: '1.0.0', os: ['darwin'] }])
        if (name === 'linux-ok')
          return makePackument('linux-ok', [{ version: '1.0.0', os: ['linux'] }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.has('darwin-only@1.0.0')).toBe(false)
      expect(result.has('linux-ok@1.0.0')).toBe(true)
    })

    it('uses per-version libc to distinguish platform builds (glibc vs musl)', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            {
              version: '1.0.0',
              optionalDeps: { 'native-gnu': '^1.0.0', 'native-musl': '^1.0.0' },
            },
          ])
        if (name === 'native-gnu')
          return makePackument('native-gnu', [
            { version: '1.0.0', os: ['linux'], cpu: ['x64'], unpackedSize: 100 },
          ])
        if (name === 'native-musl')
          return makePackument('native-musl', [
            { version: '1.0.0', os: ['linux'], cpu: ['x64'], unpackedSize: 200 },
          ])
        return null
      })
      // Abbreviated metadata omits `libc`, so it comes from the per-version manifest.
      mockVersionLibc.mockImplementation(async (name: string) =>
        name === 'native-gnu' ? ['glibc'] : ['musl'],
      )

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.has('native-gnu@1.0.0')).toBe(true)
      expect(result.has('native-musl@1.0.0')).toBe(false)
    })

    it('does not fetch libc for versions without platform restrictions', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [{ version: '1.0.0', deps: { plain: '^1.0.0' } }])
        if (name === 'plain') return makePackument('plain', [{ version: '1.0.0' }])
        return null
      })

      await resolveDependencyTree('root', '1.0.0')

      expect(mockVersionLibc).not.toHaveBeenCalled()
    })

    it('keeps required deps but skips optional ones when the libc lookup fails', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            {
              version: '1.0.0',
              deps: { 'linux-required': '^1.0.0' },
              optionalDeps: { 'linux-optional': '^1.0.0' },
            },
          ])
        if (name === 'linux-required')
          return makePackument('linux-required', [{ version: '1.0.0', os: ['linux'] }])
        if (name === 'linux-optional')
          return makePackument('linux-optional', [{ version: '1.0.0', os: ['linux'] }])
        return null
      })
      mockVersionLibc.mockRejectedValue(new Error('registry unavailable'))

      const result = await resolveDependencyTree('root', '1.0.0')

      // npm installs or fails on a required dep, so it must not silently vanish (with its vulns).
      expect(result.has('linux-required@1.0.0')).toBe(true)
      // An unknown libc could be the incompatible build, so optional deps are skipped.
      expect(result.has('linux-optional@1.0.0')).toBe(false)
    })

    it('does not fetch libc when os/cpu already exclude the target platform', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [{ version: '1.0.0', deps: { 'darwin-only': '^1.0.0' } }])
        if (name === 'darwin-only')
          return makePackument('darwin-only', [
            { version: '1.0.0', os: ['darwin'], cpu: ['arm64'] },
          ])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.has('darwin-only@1.0.0')).toBe(false)
      expect(mockVersionLibc).not.toHaveBeenCalled()
    })

    it('skips dependencies with unresolvable version ranges', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [{ version: '1.0.0', deps: { missing: '^99.0.0' } }])
        if (name === 'missing') return makePackument('missing', [{ version: '1.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.size).toBe(1)
      expect(result.has('root@1.0.0')).toBe(true)
    })

    it('continues resolving when fetchPackument fails for a dependency', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            { version: '1.0.0', deps: { broken: '^1.0.0', healthy: '^1.0.0' } },
          ])
        if (name === 'broken') return null
        if (name === 'healthy') return makePackument('healthy', [{ version: '1.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.size).toBe(2)
      expect(result.has('root@1.0.0')).toBe(true)
      expect(result.has('healthy@1.0.0')).toBe(true)
      expect(result.has('broken@1.0.0')).toBe(false)
    })

    it('assigns depth and path when trackDepth is enabled', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [{ version: '1.0.0', deps: { mid: '^1.0.0' } }])
        if (name === 'mid')
          return makePackument('mid', [{ version: '1.0.0', deps: { leaf: '^1.0.0' } }])
        if (name === 'leaf') return makePackument('leaf', [{ version: '1.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0', { trackDepth: true })

      expect(result.get('root@1.0.0')).toMatchObject({
        depth: 'root',
        path: ['root@1.0.0'],
      })
      expect(result.get('mid@1.0.0')).toMatchObject({
        depth: 'direct',
        path: ['root@1.0.0', 'mid@1.0.0'],
      })
      expect(result.get('leaf@1.0.0')).toMatchObject({
        depth: 'transitive',
        path: ['root@1.0.0', 'mid@1.0.0', 'leaf@1.0.0'],
      })
    })

    it('does not include depth/path when trackDepth is not enabled', async () => {
      mockAbbreviatedPackument.mockResolvedValue(makePackument('root', [{ version: '1.0.0' }]))

      const result = await resolveDependencyTree('root', '1.0.0')

      const pkg = result.get('root@1.0.0')!
      expect(pkg.depth).toBeUndefined()
      expect(pkg.path).toBeUndefined()
    })

    it('includes deprecated field on deprecated versions', async () => {
      mockAbbreviatedPackument.mockResolvedValue(
        makePackument('root', [{ version: '1.0.0', deprecated: 'Use v2 instead' }]),
      )

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.get('root@1.0.0')).toMatchObject({ deprecated: 'Use v2 instead' })
    })

    it('defaults size to 0 when unpackedSize is missing', async () => {
      mockAbbreviatedPackument.mockResolvedValue(makePackument('root', [{ version: '1.0.0' }]))

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.get('root@1.0.0')!.size).toBe(0)
    })

    it('deduplicates the same name@version appearing via multiple paths', async () => {
      // root → a, root → b, both a and b depend on shared@1.0.0
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [{ version: '1.0.0', deps: { a: '^1.0.0', b: '^1.0.0' } }])
        if (name === 'a')
          return makePackument('a', [{ version: '1.0.0', deps: { shared: '^1.0.0' } }])
        if (name === 'b')
          return makePackument('b', [{ version: '1.0.0', deps: { shared: '^1.0.0' } }])
        if (name === 'shared') return makePackument('shared', [{ version: '1.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      // root + a + b + shared (only once)
      expect(result.size).toBe(4)
      expect(result.has('shared@1.0.0')).toBe(true)
    })
  })
})
