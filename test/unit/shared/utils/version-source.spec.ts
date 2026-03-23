import { describe, expect, it } from 'vitest'
import { isUrlDependency } from '#shared/utils/version-source'

describe('version-source', () => {
  describe('isUrlDependency', () => {
    it('returns false for semver ranges', () => {
      expect(isUrlDependency('^1.0.0')).toBe(false)
      expect(isUrlDependency('~2.3.4')).toBe(false)
      expect(isUrlDependency('>=1.0.0 <2.0.0')).toBe(false)
      expect(isUrlDependency('*')).toBe(false)
      expect(isUrlDependency('1.0.0')).toBe(false)
      expect(isUrlDependency('2.0.0-beta.1')).toBe(false)
    })

    it('returns false for npm: protocol aliases', () => {
      expect(isUrlDependency('npm:other-pkg@^1.0.0')).toBe(false)
      expect(isUrlDependency('npm:@scope/pkg@2.0.0')).toBe(false)
    })

    it('returns true for git: protocol', () => {
      expect(isUrlDependency('git://github.com/user/repo.git')).toBe(true)
    })

    it('returns true for git+https: protocol', () => {
      expect(isUrlDependency('git+https://github.com/user/repo.git')).toBe(true)
    })

    it('returns true for git+ssh: protocol', () => {
      expect(isUrlDependency('git+ssh://git@github.com:user/repo.git')).toBe(true)
    })

    it('returns true for git+http: protocol', () => {
      expect(isUrlDependency('git+http://github.com/user/repo.git')).toBe(true)
    })

    it('returns true for https: URLs', () => {
      expect(isUrlDependency('https://github.com/user/repo/tarball/main')).toBe(true)
    })

    it('returns true for http: URLs', () => {
      expect(isUrlDependency('http://example.com/pkg.tgz')).toBe(true)
    })

    it('returns true for file: protocol', () => {
      expect(isUrlDependency('file:../local-pkg')).toBe(true)
      expect(isUrlDependency('file:./packages/my-lib')).toBe(true)
    })

    it('returns true for GitHub shorthand (user/repo)', () => {
      expect(isUrlDependency('user/repo')).toBe(true)
      expect(isUrlDependency('user/repo#branch')).toBe(true)
      expect(isUrlDependency('user/repo#semver:^1.0.0')).toBe(true)
    })

    it('returns true for github: prefix', () => {
      expect(isUrlDependency('github:user/repo')).toBe(true)
    })

    it('returns true for gist: prefix', () => {
      expect(isUrlDependency('gist:11081aaa281')).toBe(true)
    })

    it('returns true for bitbucket: prefix', () => {
      expect(isUrlDependency('bitbucket:user/repo')).toBe(true)
    })

    it('returns true for gitlab: prefix', () => {
      expect(isUrlDependency('gitlab:user/repo')).toBe(true)
    })

    it('returns false for scoped packages in semver ranges', () => {
      // Scoped packages start with @ so they won't match the user/repo pattern
      expect(isUrlDependency('@scope/pkg')).toBe(false)
    })
  })
})
