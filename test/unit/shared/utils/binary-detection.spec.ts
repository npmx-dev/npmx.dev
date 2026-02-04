import { describe, expect, it } from 'vitest'
import { isBinaryOnlyPackage, isCreatePackage } from '../../../../shared/utils/binary-detection'

describe('binary-detection', () => {
  describe('isCreatePackage', () => {
    it('returns true for create-* packages', () => {
      expect(isCreatePackage('create-vite')).toBe(true)
      expect(isCreatePackage('create-svelte-app')).toBe(true)
      expect(isCreatePackage('create-lit-app')).toBe(true)
    })

    it('returns true for scoped create-* packages', () => {
      expect(isCreatePackage('@lit/create-lit')).toBe(true)
      expect(isCreatePackage('@scope/create-something')).toBe(true)
    })

    it('returns false for non-create packages', () => {
      expect(isCreatePackage('vite')).toBe(false)
      expect(isCreatePackage('lit')).toBe(false)
      expect(isCreatePackage('my-create-tool')).toBe(false)
    })

    it('returns false for scoped non-create packages', () => {
      expect(isCreatePackage('@scope/some-package')).toBe(false)
    })
  })

  describe('isBinaryOnlyPackage', () => {
    it('returns true for create-* packages regardless of fields', () => {
      expect(isBinaryOnlyPackage({ name: 'create-vite' })).toBe(true)
      expect(isBinaryOnlyPackage({ name: 'create-vite', main: './index.js' })).toBe(true)
    })

    it('returns true for scoped create-* packages', () => {
      expect(isBinaryOnlyPackage({ name: '@lit/create-lit' })).toBe(true)
    })

    it('returns true for packages with bin but no entry points', () => {
      expect(isBinaryOnlyPackage({ name: 'eslint', bin: './bin/eslint.js' })).toBe(true)
      expect(
        isBinaryOnlyPackage({
          name: 'typescript',
          bin: { tsc: './bin/tsc', tsserver: './bin/tsserver' },
        }),
      ).toBe(true)
    })

    it('returns false for packages with bin and main', () => {
      expect(
        isBinaryOnlyPackage({
          name: 'eslint',
          bin: './bin/eslint.js',
          main: './lib/index.js',
        }),
      ).toBe(false)
    })

    it('returns false for packages with bin and module', () => {
      expect(
        isBinaryOnlyPackage({
          name: 'some-pkg',
          bin: './bin/cli.js',
          module: './dist/index.mjs',
        }),
      ).toBe(false)
    })

    it('returns false for packages with bin and exports', () => {
      expect(
        isBinaryOnlyPackage({
          name: 'some-pkg',
          bin: './bin/cli.js',
          exports: { '.': './dist/index.js' },
        }),
      ).toBe(false)
    })

    it('returns false for packages with no bin and no entry points', () => {
      expect(isBinaryOnlyPackage({ name: 'some-pkg' })).toBe(false)
    })

    it('returns false for packages with empty bin object', () => {
      expect(isBinaryOnlyPackage({ name: 'some-pkg', bin: {} })).toBe(false)
    })

    it('returns false for library-only packages', () => {
      expect(isBinaryOnlyPackage({ name: 'lodash', main: './lodash.js' })).toBe(false)
    })
  })
})
