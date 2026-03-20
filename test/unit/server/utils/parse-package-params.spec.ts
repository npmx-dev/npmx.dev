import { describe, expect, it } from 'vitest'
import { parsePackageParams } from '#server/utils/parse-package-params'

describe('parsePackageParams', () => {
  describe('unscoped packages', () => {
    it('parses package name without version', () => {
      const segments = ['vue']
      const result = parsePackageParams(segments)
      expect(result).toEqual({
        rawPackageName: 'vue',
        rawVersion: undefined,
      })
    })

    it('parses package name with version', () => {
      const segments = ['vue', 'v', '3.4.0']
      const result = parsePackageParams(segments)
      expect(result).toEqual({
        rawPackageName: 'vue',
        rawVersion: '3.4.0',
      })
    })

    it('parses package name with prerelease version', () => {
      const segments = ['nuxt', 'v', '4.0.0-rc.1']
      const result = parsePackageParams(segments)
      expect(result).toEqual({
        rawPackageName: 'nuxt',
        rawVersion: '4.0.0-rc.1',
      })
    })
  })

  describe('scoped packages', () => {
    it('parses scoped package name without version', () => {
      const segments = ['@nuxt', 'kit']
      const result = parsePackageParams(segments)
      expect(result).toEqual({
        rawPackageName: '@nuxt/kit',
        rawVersion: undefined,
      })
    })

    it('parses scoped package name with version', () => {
      const segments = ['@nuxt', 'kit', 'v', '1.0.0']
      const result = parsePackageParams(segments)
      expect(result).toEqual({
        rawPackageName: '@nuxt/kit',
        rawVersion: '1.0.0',
      })
    })
  })
})
