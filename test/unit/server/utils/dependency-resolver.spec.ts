import { describe, expect, it, vi } from 'vitest'
import type { PackumentVersion } from '../../../../shared/types'

// Mock Nitro globals before importing the module
vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
vi.stubGlobal('$fetch', vi.fn())

const { TARGET_PLATFORM, matchesPlatform, resolveVersion } =
  await import('../../../../server/utils/dependency-resolver')

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
      const version = {} as PackumentVersion
      expect(matchesPlatform(version)).toBe(true)
    })

    it('returns true when os includes linux', () => {
      const version = { os: ['linux', 'darwin'] } as PackumentVersion
      expect(matchesPlatform(version)).toBe(true)
    })

    it('returns false when os excludes linux', () => {
      const version = { os: ['darwin', 'win32'] } as PackumentVersion
      expect(matchesPlatform(version)).toBe(false)
    })

    it('handles negated os values (!linux)', () => {
      const version = { os: ['!win32'] } as PackumentVersion
      expect(matchesPlatform(version)).toBe(true)

      const excluded = { os: ['!linux'] } as PackumentVersion
      expect(matchesPlatform(excluded)).toBe(false)
    })

    it('returns true when cpu includes x64', () => {
      const version = { cpu: ['x64', 'arm64'] } as PackumentVersion
      expect(matchesPlatform(version)).toBe(true)
    })

    it('returns false when cpu excludes x64', () => {
      const version = { cpu: ['arm64', 'arm'] } as PackumentVersion
      expect(matchesPlatform(version)).toBe(false)
    })

    it('handles negated cpu values (!x64)', () => {
      const version = { cpu: ['!arm64'] } as PackumentVersion
      expect(matchesPlatform(version)).toBe(true)

      const excluded = { cpu: ['!x64'] } as PackumentVersion
      expect(matchesPlatform(excluded)).toBe(false)
    })

    it('returns true when libc includes glibc', () => {
      const version = { libc: ['glibc'] } as unknown as PackumentVersion
      expect(matchesPlatform(version)).toBe(true)
    })

    it('returns false when libc is musl only', () => {
      const version = { libc: ['musl'] } as unknown as PackumentVersion
      expect(matchesPlatform(version)).toBe(false)
    })

    it('handles negated libc values (!glibc)', () => {
      const version = { libc: ['!musl'] } as unknown as PackumentVersion
      expect(matchesPlatform(version)).toBe(true)

      const excluded = { libc: ['!glibc'] } as unknown as PackumentVersion
      expect(matchesPlatform(excluded)).toBe(false)
    })

    it('requires all platform constraints to match', () => {
      const version = {
        os: ['linux'],
        cpu: ['arm64'], // doesn't match x64
      } as PackumentVersion
      expect(matchesPlatform(version)).toBe(false)
    })

    it('ignores empty arrays', () => {
      const version = { os: [], cpu: [], libc: [] } as unknown as PackumentVersion
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
})
