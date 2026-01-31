import { describe, expect, it } from 'vitest'
import { isPlatformSpecificPackage } from '../../../../app/utils/platform-packages'

describe('isPlatformSpecificPackage', () => {
  describe('standard platform packages', () => {
    it.each([
      'esbuild-linux-x64',
      'esbuild-darwin-arm64',
      'esbuild-win32-x64',
      'esbuild-win32-ia32',
      'esbuild-freebsd-x64',
      'esbuild-android-arm64',
    ])('detects "%s" as platform-specific', name => {
      expect(isPlatformSpecificPackage(name)).toBe(true)
    })
  })

  describe('scoped platform packages', () => {
    it.each([
      '@oxlint/win32-x64',
      '@oxlint/linux-arm64',
      '@oxlint/darwin-arm64',
      '@swc/core-win32-x64-msvc',
      '@swc/core-linux-x64-gnu',
      '@swc/core-linux-arm64-musl',
      '@rollup/rollup-linux-x64-gnu',
      '@rollup/rollup-darwin-arm64',
      '@rollup/rollup-win32-x64-msvc',
      '@esbuild/linux-x64',
      '@esbuild/darwin-arm64',
      '@esbuild/win32-ia32',
    ])('detects "%s" as platform-specific', name => {
      expect(isPlatformSpecificPackage(name)).toBe(true)
    })
  })

  describe('packages with ABI suffixes', () => {
    it.each([
      'pkg-linux-x64-gnu',
      'pkg-linux-x64-musl',
      'pkg-win32-x64-msvc',
      'pkg-win32-arm64-msvc',
      'pkg-linux-arm-gnueabihf',
    ])('detects "%s" with ABI suffix as platform-specific', name => {
      expect(isPlatformSpecificPackage(name)).toBe(true)
    })
  })

  describe('all platform combinations', () => {
    it.each([
      // Windows variants
      'pkg-win32-x64',
      'pkg-win32-arm64',
      'pkg-win32-ia32',
      // macOS variants
      'pkg-darwin-x64',
      'pkg-darwin-arm64',
      // Linux variants
      'pkg-linux-x64',
      'pkg-linux-arm64',
      'pkg-linux-arm',
      'pkg-linux-ia32',
      'pkg-linux-ppc64',
      'pkg-linux-ppc64le',
      'pkg-linux-s390x',
      'pkg-linux-riscv64',
      'pkg-linux-mips64el',
      'pkg-linux-loong64',
      // Android
      'pkg-android-arm64',
      'pkg-android-arm',
      'pkg-android-x64',
      // BSD variants
      'pkg-freebsd-x64',
      'pkg-freebsd-arm64',
      'pkg-openbsd-x64',
      'pkg-netbsd-x64',
      // Others
      'pkg-sunos-x64',
      'pkg-aix-ppc64',
    ])('detects "%s" as platform-specific', name => {
      expect(isPlatformSpecificPackage(name)).toBe(true)
    })
  })

  describe('false positives - should NOT match', () => {
    it.each([
      'linux-tips',
      'node-linux',
      'darwin-utils',
      'win32-api',
      'android-sdk',
      'express',
      'react',
      'vue',
      '@types/node',
      '@babel/core',
      'lodash',
      'typescript',
      'eslint',
      'prettier',
      'platform-tools',
      'arch-decision-records',
      'arm-controller',
      'x64-utils',
    ])('does NOT detect "%s" as platform-specific', name => {
      expect(isPlatformSpecificPackage(name)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns false for empty string', () => {
      expect(isPlatformSpecificPackage('')).toBe(false)
    })

    it('returns false for scoped package with empty name', () => {
      expect(isPlatformSpecificPackage('@scope/')).toBe(false)
    })

    it('returns false for single-part names', () => {
      expect(isPlatformSpecificPackage('linux')).toBe(false)
      expect(isPlatformSpecificPackage('x64')).toBe(false)
    })

    it('returns false for package with only OS, no arch', () => {
      expect(isPlatformSpecificPackage('pkg-linux')).toBe(false)
      expect(isPlatformSpecificPackage('pkg-darwin')).toBe(false)
      expect(isPlatformSpecificPackage('pkg-win32')).toBe(false)
    })

    it('returns false for package with only arch, no OS', () => {
      expect(isPlatformSpecificPackage('pkg-x64')).toBe(false)
      expect(isPlatformSpecificPackage('pkg-arm64')).toBe(false)
    })

    it('is conservative with OS-arch in middle of name followed by unknown suffix', () => {
      // These have unknown suffixes after the arch, so we're conservative
      expect(isPlatformSpecificPackage('my-linux-x64-bindings')).toBe(false)
      expect(isPlatformSpecificPackage('@scope/my-darwin-arm64-lib')).toBe(false)
    })

    it('is conservative with unknown suffixes at the end', () => {
      // Unknown suffix after arch at the very end - should be conservative
      expect(isPlatformSpecificPackage('pkg-linux-x64-unknown')).toBe(false)
      // But if there are more parts after, still matches
      expect(isPlatformSpecificPackage('pkg-linux-x64-foo-bar')).toBe(true)
    })
  })
})
