import { describe, expect, it, vi, beforeEach } from 'vite-plus/test'
import type { AbbreviatedPackument, AbbreviatedPackumentVersion } from '#shared/types'

// Mock Nitro globals before importing the module
vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
vi.stubGlobal('$fetch', vi.fn())

const mockAbbreviatedPackument = vi.fn<(name: string) => Promise<AbbreviatedPackument | null>>()
vi.stubGlobal('fetchNpmPackageAbbreviated', mockAbbreviatedPackument)

const mockVersionLibc = vi.fn<(name: string, version: string) => Promise<string[] | undefined>>()
vi.stubGlobal('fetchNpmPackageVersionLibc', mockVersionLibc)

interface VersionsMeta {
  versions: string[]
  time: Record<string, string>
  distTags: Record<string, string>
}
const mockVersionsMeta = vi.fn<(name: string) => Promise<VersionsMeta | null>>()
vi.stubGlobal('fetchNpmPackageVersionsMeta', mockVersionsMeta)

type MockPackument = AbbreviatedPackument & { time: Record<string, string> }

/**
 * Serves both the abbreviated packument and the publish-time lookup from one fixture,
 * like the registry and fast-npm-meta would for the same package.
 */
function mockRegistry(resolve: (name: string) => Promise<MockPackument | null>) {
  // The real abbreviated packument has no `time`, so neither does the mock.
  mockAbbreviatedPackument.mockImplementation(async name => {
    const packument = await resolve(name)
    if (!packument) return null
    const { time: _time, ...abbreviated } = packument
    return abbreviated
  })
  mockVersionsMeta.mockImplementation(async name => {
    const packument = await resolve(name)
    if (!packument) return null
    return {
      versions: Object.keys(packument.versions),
      time: packument.time,
      distTags: packument['dist-tags'] ?? {},
    }
  })
}

const {
  TARGET_PLATFORM,
  matchesPlatform,
  resolveVersion,
  resolveDependencyTree,
  getDependenciesResolutionLimitPure,
  getDependenciesResolutionLimit,
  RESOLUTION_GRACE_MS,
} = await import('#server/utils/dependency-resolver')

const day = (n: number) => new Date(Date.UTC(2026, 0, n)).toISOString()
const minutes = (n: number) => n * 60 * 1000

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
    time?: string
  }>,
): MockPackument {
  const versionsMap: Record<string, AbbreviatedPackumentVersion> = {}
  const time: Record<string, string> = {}
  for (const v of versions) {
    if (v.time) time[v.version] = v.time
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
  return { name, versions: versionsMap, time }
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

    describe('with a `before` timestamp', () => {
      const time = {
        '1.0.0': day(1),
        '1.0.1': day(2),
        '1.1.0': day(10),
        '2.0.0': day(11),
        '2.0.0-beta.1': day(9),
        '3.0.0': day(20),
      }

      it('ignores versions published after it', () => {
        expect(
          resolveVersion('^1.0.0', versions, { before: Date.parse(day(5)), versionsTimes: time }),
        ).toBe('1.0.1')
        expect(
          resolveVersion('^1.0.0', versions, { before: Date.parse(day(15)), versionsTimes: time }),
        ).toBe('1.1.0')
      })

      it('includes versions published exactly at it', () => {
        expect(
          resolveVersion('^1.0.0', versions, { before: Date.parse(day(10)), versionsTimes: time }),
        ).toBe('1.1.0')
      })

      it('resolves against every version when none is given', () => {
        expect(resolveVersion('^1.0.0', versions, { versionsTimes: time })).toBe('1.1.0')
        expect(resolveVersion('*', versions, { versionsTimes: time })).toBe('3.0.0')
      })

      it('honours an exact version regardless of it', () => {
        expect(
          resolveVersion('3.0.0', versions, { before: Date.parse(day(1)), versionsTimes: time }),
        ).toBe('3.0.0')
      })

      it('applies it through npm: aliases', () => {
        expect(
          resolveVersion('npm:other-pkg@^1.0.0', versions, {
            before: Date.parse(day(5)),
            versionsTimes: time,
          }),
        ).toBe('1.0.1')
      })

      it('keeps versions with no recorded publish time', () => {
        expect(
          resolveVersion('^1.0.0', versions, { before: Date.parse(day(5)), versionsTimes: {} }),
        ).toBe('1.1.0')
      })

      it('falls back to the first later release when nothing satisfies the range yet', () => {
        // A dependency published moments after its dependent (monorepos publish a
        // release in topological order) must stay in the tree, not disappear.
        expect(
          resolveVersion('^3.0.0', versions, { before: Date.parse(day(5)), versionsTimes: time }),
        ).toBe('3.0.0')
        // ...but as close to the limit as possible, not today's newest match.
        expect(
          resolveVersion('>=2.0.0', versions, { before: Date.parse(day(5)), versionsTimes: time }),
        ).toBe('2.0.0')
      })
    })
  })

  describe('getDependenciesResolutionLimitPure', () => {
    const versions = ['1.0.0', '1.1.0', '2.0.0']
    const time = { '1.0.0': day(1), '1.1.0': day(10), '2.0.0': day(20) }

    it('returns undefined for the newest version', () => {
      expect(getDependenciesResolutionLimitPure('2.0.0', versions, time)).toBeUndefined()
    })

    it('stops short of the next release', () => {
      expect(getDependenciesResolutionLimitPure('1.1.0', versions, time)).toBe(
        Date.parse(day(20)) - RESOLUTION_GRACE_MS,
      )
    })

    it('ignores later releases from an older line', () => {
      // A 1.x backport published after 2.0.0 doesn't supersede it: 2.0.0 is
      // still the newest of its own line, so it keeps resolving freely.
      const backport = [...versions, '1.1.1']
      const withBackport = { ...time, '1.1.1': day(25) }
      expect(getDependenciesResolutionLimitPure('1.1.1', backport, withBackport)).toBeUndefined()
      expect(getDependenciesResolutionLimitPure('2.0.0', backport, withBackport)).toBeUndefined()
      // 1.1.0 is still limited by 2.0.0, which does supersede it.
      expect(getDependenciesResolutionLimitPure('1.1.0', backport, withBackport)).toBe(
        Date.parse(day(20)) - RESOLUTION_GRACE_MS,
      )
    })

    it('is not limited by a prerelease of a later version', () => {
      // An install still resolves to 1.0.0 once 1.1.0-beta.1 is out, so 1.0.0
      // stays current until 1.1.0 itself ships six months later.
      const withBeta = ['1.0.0', '1.1.0-beta.1', '1.1.0']
      const betaTimes = { '1.0.0': day(1), '1.1.0-beta.1': day(8), '1.1.0': day(20) }

      expect(getDependenciesResolutionLimitPure('1.0.0', withBeta, betaTimes)).toBe(
        Date.parse(day(20)) - RESOLUTION_GRACE_MS,
      )
    })

    it('limits a prerelease by the releases above it', () => {
      const betas = ['1.0.0', '1.1.0-beta.1', '1.1.0-beta.2', '1.1.0']
      const betaTimes = {
        '1.0.0': day(1),
        '1.1.0-beta.1': day(8),
        '1.1.0-beta.2': day(12),
        '1.1.0': day(20),
      }

      // A newer prerelease supersedes an older one...
      expect(getDependenciesResolutionLimitPure('1.1.0-beta.1', betas, betaTimes)).toBe(
        Date.parse(day(12)) - RESOLUTION_GRACE_MS,
      )
      // ...and so does the stable release they lead to.
      expect(getDependenciesResolutionLimitPure('1.1.0-beta.2', betas, betaTimes)).toBe(
        Date.parse(day(20)) - RESOLUTION_GRACE_MS,
      )
    })

    it('leaves every line-leading version unlimited', () => {
      // Released in this order, only 1.0.0 and 2.0.0 were ever superseded.
      const released = ['1.0.0', '2.0.0', '3.0.0', '2.1.0', '1.1.0']
      const releasedTimes = {
        '1.0.0': day(1),
        '2.0.0': day(2),
        '3.0.0': day(3),
        '2.1.0': day(4),
        '1.1.0': day(5),
      }

      for (const leading of ['3.0.0', '2.1.0', '1.1.0']) {
        expect(getDependenciesResolutionLimitPure(leading, released, releasedTimes)).toBeUndefined()
      }

      expect(getDependenciesResolutionLimitPure('1.0.0', released, releasedTimes)).toBe(
        Date.parse(day(2)) - RESOLUTION_GRACE_MS,
      )
      expect(getDependenciesResolutionLimitPure('2.0.0', released, releasedTimes)).toBe(
        Date.parse(day(3)) - RESOLUTION_GRACE_MS,
      )
    })

    it("leaves the latest version on today's registry", () => {
      // 2.0.0 is still what an install resolves to, even though the 1.x line kept releasing after it.
      const backport = [...versions, '1.1.1']
      const withBackport = { ...time, '1.1.1': day(25) }
      expect(
        getDependenciesResolutionLimitPure('2.0.0', backport, withBackport, '2.0.0'),
      ).toBeUndefined()
      expect(getDependenciesResolutionLimitPure('1.1.0', backport, withBackport, '2.0.0')).toBe(
        Date.parse(day(20)) - RESOLUTION_GRACE_MS,
      )
    })

    it('keeps the version its own grace period when releases are close together', () => {
      // Back-to-back releases would otherwise push the timestamp before the
      // version's own batch finished publishing.
      const rapid = {
        '1.0.0': day(1),
        '1.0.1': new Date(Date.parse(day(1)) + minutes(2)).toISOString(),
      }
      expect(getDependenciesResolutionLimitPure('1.0.0', ['1.0.0', '1.0.1'], rapid)).toBe(
        Date.parse(day(1)) + RESOLUTION_GRACE_MS,
      )
    })

    it('returns undefined when the version has no publish time', () => {
      expect(getDependenciesResolutionLimitPure('1.1.0', versions, {})).toBeUndefined()
    })
  })

  describe('getDependenciesResolutionLimit', () => {
    beforeEach(() => {
      mockVersionsMeta.mockReset()
    })

    it('reads publish times from the versions metadata', async () => {
      mockRegistry(async () =>
        makePackument('pkg', [
          { version: '1.0.0', time: day(1) },
          { version: '1.1.0', time: day(10) },
        ]),
      )

      await expect(getDependenciesResolutionLimit('pkg', '1.0.0')).resolves.toBe(
        Date.parse(day(10)) - RESOLUTION_GRACE_MS,
      )
      await expect(getDependenciesResolutionLimit('pkg', '1.1.0')).resolves.toBeUndefined()
    })

    it('returns undefined when the versions metadata is unavailable', async () => {
      mockVersionsMeta.mockResolvedValue(null)

      await expect(getDependenciesResolutionLimit('pkg', '1.0.0')).resolves.toBeUndefined()
    })

    it('rejects when the versions metadata cannot be fetched', async () => {
      // Resolving against today's registry instead would be cached as frozen history.
      mockVersionsMeta.mockRejectedValue(new Error('fast-npm-meta is down'))

      await expect(getDependenciesResolutionLimit('pkg', '1.0.0')).rejects.toThrow(
        'fast-npm-meta is down',
      )
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

    it('resolves npm aliases against the aliased package', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            {
              version: '1.0.0',
              deps: { vite: 'npm:@scope/vite-fork@^1.0.0' },
              optionalDeps: { fsevents: 'npm:fsevents-fork@2.0.0' },
            },
          ])
        if (name === '@scope/vite-fork')
          return makePackument('@scope/vite-fork', [{ version: '1.2.0' }])
        if (name === 'fsevents-fork') return makePackument('fsevents-fork', [{ version: '2.0.0' }])
        // The dependency keys are real packages too, with matching versions
        if (name === 'vite')
          return makePackument('vite', [{ version: '1.2.0', deps: { unrelated: '^1.0.0' } }])
        if (name === 'fsevents') return makePackument('fsevents', [{ version: '2.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect([...result.keys()].sort()).toEqual([
        '@scope/vite-fork@1.2.0',
        'fsevents-fork@2.0.0',
        'root@1.0.0',
      ])
      expect(result.get('fsevents-fork@2.0.0')).toMatchObject({ optional: true })
      expect(mockAbbreviatedPackument).not.toHaveBeenCalledWith('vite')
      expect(mockAbbreviatedPackument).not.toHaveBeenCalledWith('fsevents')
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

    describe('with a `before` timestamp', () => {
      // A monorepo that releases its packages together: core@1.0.0 shipped
      // alongside lib@1.0.0, then both shrank by half in the 1.1.0 release.
      const monorepo = async (name: string) => {
        if (name === 'core')
          return makePackument('core', [
            { version: '1.0.0', deps: { lib: '^1.0.0' }, unpackedSize: 1000, time: day(1) },
            { version: '1.1.0', deps: { lib: '^1.0.0' }, unpackedSize: 500, time: day(10) },
          ])
        if (name === 'lib')
          return makePackument('lib', [
            { version: '1.0.0', unpackedSize: 1000, time: day(1) },
            { version: '1.1.0', unpackedSize: 500, time: day(10) },
          ])
        return null
      }

      beforeEach(() => {
        mockRegistry(monorepo)
      })

      it('resolves a superseded version against the registry of its own time', async () => {
        const before = getDependenciesResolutionLimitPure('1.0.0', ['1.0.0', '1.1.0'], {
          '1.0.0': day(1),
          '1.1.0': day(10),
        })

        const result = await resolveDependencyTree('core', '1.0.0', { before })

        expect(result.has('lib@1.0.0')).toBe(true)
        expect(result.get('lib@1.0.0')!.size).toBe(1000)
      })

      it('resolves the newest version against today (unrestricted)', async () => {
        const result = await resolveDependencyTree('core', '1.1.0')

        expect(result.has('lib@1.1.0')).toBe(true)
      })

      it('would otherwise credit the old version with the later shrink', async () => {
        // Regression guard: unrestricted, core@1.0.0 pulls in today's lib.
        const result = await resolveDependencyTree('core', '1.0.0')

        expect(result.has('lib@1.1.0')).toBe(true)
      })

      it('keeps a sibling published later in the same release batch', async () => {
        // lib@1.1.0 landing after core@1.1.0 must not drop lib from the tree.
        mockRegistry(async (name: string) => {
          if (name === 'core')
            return makePackument('core', [
              { version: '1.1.0', deps: { lib: '^1.1.0' }, unpackedSize: 500, time: day(10) },
            ])
          if (name === 'lib')
            return makePackument('lib', [
              {
                version: '1.1.0',
                unpackedSize: 500,
                time: new Date(Date.parse(day(10)) + minutes(30)).toISOString(),
              },
            ])
          return null
        })

        const result = await resolveDependencyTree('core', '1.1.0', {
          before: Date.parse(day(10)) + RESOLUTION_GRACE_MS,
        })

        expect(result.has('lib@1.1.0')).toBe(true)
      })

      it('rejects when the publish times of a dependency cannot be fetched', async () => {
        mockVersionsMeta.mockImplementation(async name => {
          if (name === 'lib') throw new Error('fast-npm-meta is down')
          return { versions: ['1.0.0', '1.1.0'], time: { '1.0.0': day(1) }, distTags: {} }
        })

        await expect(
          resolveDependencyTree('core', '1.0.0', { before: Date.parse(day(5)) }),
        ).rejects.toThrow('fast-npm-meta is down')
      })

      it('ignores releases newer than the publish times snapshot', async () => {
        // The packument already lists lib@1.1.0, but the cached publish times predate it.
        mockVersionsMeta.mockResolvedValue({
          versions: ['1.0.0'],
          time: { '1.0.0': day(1) },
          distTags: { latest: '1.0.0' },
        })

        const result = await resolveDependencyTree('core', '1.0.0', { before: Date.parse(day(5)) })

        expect([...result.keys()].sort()).toEqual(['core@1.0.0', 'lib@1.0.0'])
      })
    })

    it('keeps distinct versions requested through aliases of the same package', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            {
              version: '1.0.0',
              deps: { 'shared-v1': 'npm:shared@^1.0.0', 'shared-v2': 'npm:shared@^2.0.0' },
            },
          ])
        if (name === 'shared')
          return makePackument('shared', [
            { version: '1.0.0', deps: { 'only-v1': '^1.0.0' } },
            { version: '2.0.0', deps: { 'only-v2': '^1.0.0' } },
          ])
        if (name === 'only-v1') return makePackument('only-v1', [{ version: '1.0.0' }])
        if (name === 'only-v2') return makePackument('only-v2', [{ version: '1.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect([...result.keys()].sort()).toEqual([
        'only-v1@1.0.0',
        'only-v2@1.0.0',
        'root@1.0.0',
        'shared@1.0.0',
        'shared@2.0.0',
      ])
    })

    it('resolves a different version of a package that was already visited', async () => {
      // root → shared@^1 and root → a → shared@^2
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            { version: '1.0.0', deps: { shared: '^1.0.0', a: '^1.0.0' } },
          ])
        if (name === 'a')
          return makePackument('a', [{ version: '1.0.0', deps: { shared: '^2.0.0' } }])
        if (name === 'shared')
          return makePackument('shared', [{ version: '1.0.0' }, { version: '2.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0', { trackDepth: true })

      expect(result.get('shared@1.0.0')).toMatchObject({ depth: 'direct' })
      expect(result.get('shared@2.0.0')).toMatchObject({
        depth: 'transitive',
        path: ['root@1.0.0', 'a@1.0.0', 'shared@2.0.0'],
      })
    })

    it('keeps distinct versions requested as optional dependencies', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [
            { version: '1.0.0', deps: { a: '^1.0.0' }, optionalDeps: { opt: '^1.0.0' } },
          ])
        if (name === 'a')
          return makePackument('a', [{ version: '1.0.0', optionalDeps: { opt: '^2.0.0' } }])
        if (name === 'opt')
          return makePackument('opt', [{ version: '1.0.0' }, { version: '2.0.0' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect(result.get('opt@1.0.0')).toMatchObject({ optional: true })
      expect(result.get('opt@2.0.0')).toMatchObject({ optional: true })
    })

    it('resolves different ranges that match the same version once', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'root')
          return makePackument('root', [{ version: '1.0.0', deps: { a: '^1.0.0', b: '^1.0.0' } }])
        if (name === 'a')
          return makePackument('a', [{ version: '1.0.0', deps: { shared: '^1.0.0' } }])
        if (name === 'b')
          return makePackument('b', [{ version: '1.0.0', deps: { shared: '~1.2.0' } }])
        if (name === 'shared') return makePackument('shared', [{ version: '1.2.3' }])
        return null
      })

      const result = await resolveDependencyTree('root', '1.0.0')

      expect([...result.keys()].sort()).toEqual([
        'a@1.0.0',
        'b@1.0.0',
        'root@1.0.0',
        'shared@1.2.3',
      ])
    })

    it('terminates cycles between different versions of the same package', async () => {
      mockAbbreviatedPackument.mockImplementation(async (name: string) => {
        if (name === 'a')
          return makePackument('a', [
            { version: '1.0.0', deps: { a: '^2.0.0' } },
            { version: '2.0.0', deps: { a: '^1.0.0' } },
          ])
        return null
      })

      const result = await resolveDependencyTree('a', '1.0.0')

      expect([...result.keys()].sort()).toEqual(['a@1.0.0', 'a@2.0.0'])
    })
  })
})
