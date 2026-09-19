import { describe, expect, it } from 'vitest'
import { parsePackageParam, parsePackageSpec } from '#shared/utils/parse-package-param'

describe('parsePackageParam', () => {
  describe('unscoped packages', () => {
    it('parses package name without version', () => {
      const result = parsePackageParam('vue')
      expect(result).toEqual({
        packageName: 'vue',
        version: undefined,
        rest: [],
      })
    })

    it('parses package name with version', () => {
      const result = parsePackageParam('vue/v/3.4.0')
      expect(result).toEqual({
        packageName: 'vue',
        version: '3.4.0',
        rest: [],
      })
    })

    it('parses package name with prerelease version', () => {
      const result = parsePackageParam('nuxt/v/4.0.0-rc.1')
      expect(result).toEqual({
        packageName: 'nuxt',
        version: '4.0.0-rc.1',
        rest: [],
      })
    })

    it('parses package name with version and file path', () => {
      const result = parsePackageParam('vue/v/3.4.0/src/index.ts')
      expect(result).toEqual({
        packageName: 'vue',
        version: '3.4.0',
        rest: ['src', 'index.ts'],
      })
    })

    it('parses package name with version and nested file path', () => {
      const result = parsePackageParam('lodash/v/4.17.21/lib/fp/map.js')
      expect(result).toEqual({
        packageName: 'lodash',
        version: '4.17.21',
        rest: ['lib', 'fp', 'map.js'],
      })
    })
  })

  describe('scoped packages', () => {
    it('parses scoped package name without version', () => {
      const result = parsePackageParam('@nuxt/kit')
      expect(result).toEqual({
        packageName: '@nuxt/kit',
        version: undefined,
        rest: [],
      })
    })

    it('parses scoped package name with version', () => {
      const result = parsePackageParam('@nuxt/kit/v/1.0.0')
      expect(result).toEqual({
        packageName: '@nuxt/kit',
        version: '1.0.0',
        rest: [],
      })
    })

    it('parses scoped package name with version and file path', () => {
      const result = parsePackageParam('@vue/compiler-sfc/v/3.5.0/dist/index.d.ts')
      expect(result).toEqual({
        packageName: '@vue/compiler-sfc',
        version: '3.5.0',
        rest: ['dist', 'index.d.ts'],
      })
    })

    it('parses deeply nested scoped packages', () => {
      const result = parsePackageParam('@types/node/v/22.0.0')
      expect(result).toEqual({
        packageName: '@types/node',
        version: '22.0.0',
        rest: [],
      })
    })

    it('parses scoped package names whose package segment is literally v', () => {
      const result = parsePackageParam('@scope/v/v/1.2.3/dist/index.js')
      expect(result).toEqual({
        packageName: '@scope/v',
        version: '1.2.3',
        rest: ['dist', 'index.js'],
      })
    })
  })

  describe('edge cases', () => {
    it('handles package name that looks like a version marker', () => {
      // Package named "v" shouldn't be confused with version separator
      const result = parsePackageParam('v')
      expect(result).toEqual({
        packageName: 'v',
        version: undefined,
        rest: [],
      })
    })

    it('handles version segment without actual version', () => {
      // "v" at the end without a version after it
      const result = parsePackageParam('vue/v')
      expect(result).toEqual({
        packageName: 'vue/v',
        version: undefined,
        rest: [],
      })
    })

    it('handles package with "v" in the name followed by version', () => {
      const result = parsePackageParam('vueuse/v/12.0.0')
      expect(result).toEqual({
        packageName: 'vueuse',
        version: '12.0.0',
        rest: [],
      })
    })

    it('handles empty rest when file path is empty', () => {
      const result = parsePackageParam('react/v/18.2.0')
      expect(result.rest).toEqual([])
      expect(result.rest.length).toBe(0)
    })
  })
})

describe('parsePackageSpec', () => {
  it('parses unscoped package with exact version', () => {
    expect(parsePackageSpec('esbuild@0.25.12')).toEqual({
      name: 'esbuild',
      version: '0.25.12',
    })
  })

  it('parses unscoped package with caret range', () => {
    expect(parsePackageSpec('react@^18.0.0')).toEqual({
      name: 'react',
      version: '^18.0.0',
    })
  })

  it('parses scoped package with exact version', () => {
    expect(parsePackageSpec('@angular/core@18.0.0')).toEqual({
      name: '@angular/core',
      version: '18.0.0',
    })
  })

  it('parses scoped package with range', () => {
    expect(parsePackageSpec('@angular/core@^18')).toEqual({
      name: '@angular/core',
      version: '^18',
    })
  })

  it('returns name only for unscoped package without version', () => {
    expect(parsePackageSpec('esbuild')).toEqual({ name: 'esbuild' })
  })

  it('returns name only for scoped package without version', () => {
    expect(parsePackageSpec('@angular/core')).toEqual({ name: '@angular/core' })
  })

  it('returns name only for bare scope', () => {
    expect(parsePackageSpec('@angular')).toEqual({ name: '@angular' })
  })

  it('handles trailing @ with no version', () => {
    expect(parsePackageSpec('esbuild@')).toEqual({ name: 'esbuild', version: '' })
  })

  it('parses version with union range', () => {
    expect(parsePackageSpec('@angular/core@^18 || ^19')).toEqual({
      name: '@angular/core',
      version: '^18 || ^19',
    })
  })

  it('parses dist-tag as version', () => {
    expect(parsePackageSpec('nuxt@latest')).toEqual({
      name: 'nuxt',
      version: 'latest',
    })
  })
})

describe('parsePackageParam', () => {
  it('parses scoped package names whose package segment is literally v', () => {
    const result = parsePackageParam('@scope/v/v/1.2.3/dist/index.js')
    expect(result).toEqual({
      packageName: '@scope/v',
      version: '1.2.3',
      rest: ['dist', 'index.js'],
    })
  })
})
