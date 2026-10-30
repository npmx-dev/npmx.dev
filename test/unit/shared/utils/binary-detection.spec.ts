import { describe, expect, it } from 'vitest'
import { isCreatePackage } from '#shared/utils/binary-detection'

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
})
