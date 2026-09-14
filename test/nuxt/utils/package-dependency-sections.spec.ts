import { describe, expect, it } from 'vitest'
import {
  getDefaultDependencySection,
  getPackageDependencySections,
  hasPackageDependencies,
  inferDependencyRegistry,
  normalizeDependencies,
} from '~/utils/npm/package-dependency-sections'

describe('package-dependency-sections', () => {
  it('normalizes dependency records stripping protocol aliases', () => {
    const raw = {
      'vue': '^3.0.0',
      'typescript7': 'npm:typescript@^7.0.2',
      'std-path': 'jsr:@std/path@^1.0.0',
    }
    expect(normalizeDependencies(raw)).toEqual({
      'vue': { name: 'vue', version: '^3.0.0' },
      'typescript7': { name: 'typescript', version: '^7.0.2' },
      'std-path': { name: '@std/path', version: '^1.0.0' },
    })
  })

  it('detects jsr registry from package name', () => {
    expect(inferDependencyRegistry('@jsr/std__path', '^1.0.0')).toBe('jsr')
    expect(inferDependencyRegistry('lodash', '^4.0.0')).toBe('npm')
  })

  it('builds sections in order and omits empty ones', () => {
    const sections = getPackageDependencySections({
      dependencies: { lodash: '^4.0.0' },
      devDependencies: { vitest: '^1.0.0' },
      peerDependencies: { vue: '^3.0.0' },
      peerDependenciesMeta: { vue: { optional: true } },
    })

    expect(sections.map(s => s.id)).toEqual(['dependencies', 'devDependencies', 'peerDependencies'])
    expect(sections[2]?.items[0]?.flags).toContain('optional')
  })

  it('correctly handles alias dependencies', () => {
    const sections = getPackageDependencySections({
      dependencies: {
        typescript: 'npm:typescript@^7.0.2',
        typescript5: 'npm:typescript@~5.7.3',
        typescript6: 'npm:typescript@^6.0.3',
      },
    })

    expect(sections[0]?.items).toEqual([
      {
        name: 'typescript',
        packageName: 'typescript',
        range: '^7.0.2',
        registry: 'npm',
        flags: [],
      },
      {
        name: 'typescript5',
        packageName: 'typescript',
        range: '~5.7.3',
        registry: 'npm',
        flags: [],
      },
      {
        name: 'typescript6',
        packageName: 'typescript',
        range: '^6.0.3',
        registry: 'npm',
        flags: [],
      },
    ])
  })

  it('reports whether a version has dependencies', () => {
    expect(hasPackageDependencies({})).toBe(false)
    expect(
      hasPackageDependencies({
        optionalDependencies: { fsevents: '^2.0.0' },
      }),
    ).toBe(true)
  })

  it('defaults to the first available section', () => {
    const sections = getPackageDependencySections({
      devDependencies: { vitest: '^1.0.0' },
    })
    expect(getDefaultDependencySection(sections)).toBe('devDependencies')
  })
})
