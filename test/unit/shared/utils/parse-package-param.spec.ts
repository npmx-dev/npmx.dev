import { describe, expect, it } from 'vitest'
import { parsePackageSpecifier } from '../../../../shared/utils/parse-package-param'

describe('parsePackageSpecifier', () => {
  it('parses unscoped package with exact version', () => {
    expect(parsePackageSpecifier('esbuild@0.25.12')).toEqual({
      name: 'esbuild',
      version: '0.25.12',
    })
  })

  it('parses unscoped package with caret range', () => {
    expect(parsePackageSpecifier('react@^18.0.0')).toEqual({
      name: 'react',
      version: '^18.0.0',
    })
  })

  it('parses scoped package with exact version', () => {
    expect(parsePackageSpecifier('@angular/core@18.0.0')).toEqual({
      name: '@angular/core',
      version: '18.0.0',
    })
  })

  it('parses scoped package with range', () => {
    expect(parsePackageSpecifier('@angular/core@^18')).toEqual({
      name: '@angular/core',
      version: '^18',
    })
  })

  it('returns name only for unscoped package without version', () => {
    expect(parsePackageSpecifier('esbuild')).toEqual({ name: 'esbuild' })
  })

  it('returns name only for scoped package without version', () => {
    expect(parsePackageSpecifier('@angular/core')).toEqual({ name: '@angular/core' })
  })

  it('returns name only for bare scope', () => {
    expect(parsePackageSpecifier('@angular')).toEqual({ name: '@angular' })
  })

  it('handles trailing @ with no version', () => {
    expect(parsePackageSpecifier('esbuild@')).toEqual({ name: 'esbuild@' })
  })

  it('parses version with union range', () => {
    expect(parsePackageSpecifier('@angular/core@^18 || ^19')).toEqual({
      name: '@angular/core',
      version: '^18 || ^19',
    })
  })

  it('parses dist-tag as version', () => {
    expect(parsePackageSpecifier('nuxt@latest')).toEqual({
      name: 'nuxt',
      version: 'latest',
    })
  })
})
