import { describe, expect, it } from 'vitest'

import { hoist } from './hoist'
import type { HoistedNode, HoistedResult, ResolvedPackage } from './types'

// #region test helpers

/**
 * creates a mock resolved package for testing.
 * supports: "name", "name@version", "@scope/name", "@scope/name@version"
 */
function pkg(spec: string, deps: ResolvedPackage[] = []): ResolvedPackage {
  let name: string
  let version = '1.0.0'

  if (spec.startsWith('@')) {
    // scoped package: @scope/name or @scope/name@version
    const slashIdx = spec.indexOf('/')
    const atIdx = spec.indexOf('@', slashIdx)
    if (atIdx === -1) {
      name = spec
    } else {
      name = spec.slice(0, atIdx)
      version = spec.slice(atIdx + 1)
    }
  } else if (spec.includes('@')) {
    // unscoped with version: name@version
    const atIdx = spec.indexOf('@')
    name = spec.slice(0, atIdx)
    version = spec.slice(atIdx + 1)
  } else {
    // unscoped without version: name
    name = spec
  }

  return {
    name,
    version,
    tarball: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
    dependencies: new Map(deps.map(d => [d.name, d])),
  }
}

/** counts packages at root level vs nested */
function countLevels(paths: string[]): { root: number; nested: number } {
  let root = 0
  let nested = 0
  for (const path of paths) {
    const depth = (path.match(/node_modules/g) || []).length
    if (depth === 1) {
      root++
    } else {
      nested++
    }
  }
  return { root, nested }
}

/**
 * converts a hoisted result to a flat list of paths.
 * useful for debugging and testing.
 *
 * @param result the hoisted result
 * @returns array of paths like ["node_modules/react", "node_modules/react/node_modules/scheduler"]
 */
function hoistedToPaths(result: HoistedResult): string[] {
  const paths: string[] = []

  function walk(nodes: Map<string, HoistedNode>, prefix: string): void {
    for (const [name, node] of nodes) {
      const path = `${prefix}/${name}`
      paths.push(path)
      if (node.nested.size > 0) {
        walk(node.nested, `${path}/node_modules`)
      }
    }
  }

  walk(result.root, 'node_modules')
  // oxlint-disable-next-line unicorn/no-array-sort
  return paths.sort()
}

// #endregion

// #region basic hoisting

describe('hoist', () => {
  describe('basic hoisting', () => {
    it('hoists single dependency to root', () => {
      // A -> B  =>  both at root
      const b = pkg('B')
      const a = pkg('A', [b])
      const result = hoist([a])
      const paths = hoistedToPaths(result)

      expect(paths).toContain('node_modules/A')
      expect(paths).toContain('node_modules/B')
      expect(countLevels(paths)).toEqual({ root: 2, nested: 0 })
    })

    it('hoists deep dependency chain to root', () => {
      // A -> B -> C -> D  =>  all at root
      const d = pkg('D')
      const c = pkg('C', [d])
      const b = pkg('B', [c])
      const a = pkg('A', [b])
      const result = hoist([a])

      expect(countLevels(hoistedToPaths(result))).toEqual({
        root: 4,
        nested: 0,
      })
    })

    it('deduplicates shared dependencies', () => {
      // A -> C, B -> C  =>  A, B, C all at root (C shared)
      const c = pkg('C')
      const a = pkg('A', [c])
      const b = pkg('B', [c])
      const result = hoist([a, b])
      const paths = hoistedToPaths(result)

      expect(countLevels(paths)).toEqual({ root: 3, nested: 0 })
      expect(paths.filter(p => p.includes('/C')).length).toBe(1)
    })

    it('handles package with no dependencies', () => {
      const a = pkg('A')
      const result = hoist([a])

      expect(countLevels(hoistedToPaths(result))).toEqual({
        root: 1,
        nested: 0,
      })
    })

    it('handles empty roots array', () => {
      const result = hoist([])

      expect(result.root.size).toBe(0)
      expect(hoistedToPaths(result)).toHaveLength(0)
    })
  })

  // #endregion

  // #region version conflicts

  describe('version conflicts', () => {
    it('nests conflicting version under parent', () => {
      // A -> B@1, B@2 (root)  =>  B@2 at root, B@1 nested under A
      const b1 = pkg('B@1.0.0')
      const b2 = pkg('B@2.0.0')
      const a = pkg('A', [b1])
      const result = hoist([a, b2])
      const paths = hoistedToPaths(result)

      expect(result.root.get('B')?.version).toBe('2.0.0')
      expect(paths).toContain('node_modules/A/node_modules/B')
      expect(countLevels(paths)).toEqual({ root: 2, nested: 1 })
    })

    it('first transitive version wins at root level', () => {
      // A -> B@1, C -> B@2  =>  B@1 hoisted (processed first), B@2 nested under C
      const b1 = pkg('B@1.0.0')
      const b2 = pkg('B@2.0.0')
      const a = pkg('A', [b1])
      const c = pkg('C', [b2])
      const result = hoist([a, c])
      const paths = hoistedToPaths(result)

      expect(result.root.get('B')?.version).toBe('1.0.0')
      expect(paths).toContain('node_modules/C/node_modules/B')
    })

    it('root package takes precedence over transitive', () => {
      // A@1 (root), B -> A@2  =>  A@1 at root, A@2 nested under B
      const a2 = pkg('A@2.0.0')
      const b = pkg('B', [a2])
      const a1 = pkg('A@1.0.0')
      const result = hoist([a1, b])
      const paths = hoistedToPaths(result)

      expect(result.root.get('A')?.version).toBe('1.0.0')
      expect(paths).toContain('node_modules/B/node_modules/A')
    })

    it('later root package overwrites earlier for same name', () => {
      // A@1, A@2 (both roots)  =>  A@2 at root (last wins)
      const a1 = pkg('A@1.0.0')
      const a2 = pkg('A@2.0.0')
      const result = hoist([a1, a2])

      expect(result.root.get('A')?.version).toBe('2.0.0')
      expect(countLevels(hoistedToPaths(result))).toEqual({
        root: 1,
        nested: 0,
      })
    })

    it('handles diamond dependency with version conflict', () => {
      // A -> C -> D@1, B -> C -> D@2  =>  C deduplicated, D version conflict handled
      const d1 = pkg('D@1.0.0')
      const d2 = pkg('D@2.0.0')
      const c1 = pkg('C', [d1])
      const c2 = pkg('C', [d2])
      const a = pkg('A', [c1])
      const b = pkg('B', [c2])
      const result = hoist([a, b])
      const paths = hoistedToPaths(result)

      // C should be deduplicated (same version)
      expect(paths.filter(p => p.endsWith('/C')).length).toBe(1)
    })

    it('preserves require chain when hoisting would break resolution', () => {
      // A -> B -> C@1, C@2 (root)  =>  C@2 at root, C@1 nested to satisfy B
      const c1 = pkg('C@1.0.0')
      const c2 = pkg('C@2.0.0')
      const b = pkg('B', [c1])
      const a = pkg('A', [b])
      const result = hoist([a, c2])
      const paths = hoistedToPaths(result)

      expect(result.root.get('C')?.version).toBe('2.0.0')
      expect(
        paths.some(p => p.includes('/B/node_modules/C') || p.includes('/A/node_modules/C')),
      ).toBe(true)
    })
  })

  // #endregion

  // #region cyclic dependencies

  describe('cyclic dependencies', () => {
    it('handles simple cycle between two packages', () => {
      // A <-> B (mutual dependency)
      const a: ResolvedPackage = {
        name: 'A',
        version: '1.0.0',
        tarball: 'https://example.com/a.tgz',
        dependencies: new Map(),
      }
      const b: ResolvedPackage = {
        name: 'B',
        version: '1.0.0',
        tarball: 'https://example.com/b.tgz',
        dependencies: new Map([['A', a]]),
      }
      a.dependencies.set('B', b)

      const result = hoist([a])

      expect(countLevels(hoistedToPaths(result))).toEqual({
        root: 2,
        nested: 0,
      })
    })

    it('handles longer cycle (A -> B -> C -> A)', () => {
      const a: ResolvedPackage = {
        name: 'A',
        version: '1.0.0',
        tarball: 'https://example.com/a.tgz',
        dependencies: new Map(),
      }
      const c: ResolvedPackage = {
        name: 'C',
        version: '1.0.0',
        tarball: 'https://example.com/c.tgz',
        dependencies: new Map([['A', a]]),
      }
      const b: ResolvedPackage = {
        name: 'B',
        version: '1.0.0',
        tarball: 'https://example.com/b.tgz',
        dependencies: new Map([['C', c]]),
      }
      a.dependencies.set('B', b)

      const result = hoist([a])

      expect(countLevels(hoistedToPaths(result))).toEqual({
        root: 3,
        nested: 0,
      })
    })

    it('handles self-dependency', () => {
      const a: ResolvedPackage = {
        name: 'A',
        version: '1.0.0',
        tarball: 'https://example.com/a.tgz',
        dependencies: new Map(),
      }
      a.dependencies.set('A', a)

      const result = hoist([a])

      expect(countLevels(hoistedToPaths(result))).toEqual({
        root: 1,
        nested: 0,
      })
    })
  })

  // #endregion

  // #region deep nesting

  describe('deep nesting', () => {
    it('handles multiple levels of conflicts', () => {
      // A -> B@1 -> C@1, B@2 -> C@2, C@3 (root)
      const c1 = pkg('C@1.0.0')
      const c2 = pkg('C@2.0.0')
      const c3 = pkg('C@3.0.0')
      const b1 = pkg('B@1.0.0', [c1])
      const b2 = pkg('B@2.0.0', [c2])
      const a = pkg('A', [b1])
      const result = hoist([a, b2, c3])
      const paths = hoistedToPaths(result)

      expect(result.root.get('C')?.version).toBe('3.0.0')
      expect(result.root.get('B')?.version).toBe('2.0.0')
      expect(paths).toContain('node_modules/A/node_modules/B')
    })

    it('nests package that would shadow parent dependency', () => {
      // A@1 -> B -> A@2  =>  A@1 at root, A@2 nested under B
      const a2 = pkg('A@2.0.0')
      const b = pkg('B', [a2])
      const a1 = pkg('A@1.0.0', [b])
      const result = hoist([a1])
      const paths = hoistedToPaths(result)

      expect(result.root.get('A')?.version).toBe('1.0.0')
      expect(paths).toContain('node_modules/B/node_modules/A')
    })

    it('handles deeply nested version conflict chain', () => {
      // A -> B@1 -> C -> D@1, E -> B@2 -> C -> D@2
      const d1 = pkg('D@1.0.0')
      const d2 = pkg('D@2.0.0')
      const c1 = pkg('C', [d1])
      const c2 = pkg('C', [d2])
      const b1 = pkg('B@1.0.0', [c1])
      const b2 = pkg('B@2.0.0', [c2])
      const a = pkg('A', [b1])
      const e = pkg('E', [b2])
      const result = hoist([a, e])
      const paths = hoistedToPaths(result)

      expect(paths).toContain('node_modules/A')
      expect(paths).toContain('node_modules/E')
      expect(result.root.get('B')?.version).toBe('1.0.0')
      expect(paths).toContain('node_modules/E/node_modules/B')
    })
  })

  // #endregion

  // #region scoped packages

  describe('scoped packages', () => {
    it('hoists scoped packages to root', () => {
      const scopedDep = pkg('@scope/dep')
      const a = pkg('A', [scopedDep])
      const result = hoist([a])
      const paths = hoistedToPaths(result)

      expect(paths).toContain('node_modules/@scope/dep')
      expect(result.root.get('@scope/dep')?.version).toBe('1.0.0')
    })

    it('handles scoped and unscoped packages with same last segment', () => {
      // @scope/foo and foo are different packages, no conflict
      const scopedFoo = pkg('@scope/foo')
      const foo = pkg('foo')
      const result = hoist([scopedFoo, foo])
      const paths = hoistedToPaths(result)

      expect(paths).toContain('node_modules/@scope/foo')
      expect(paths).toContain('node_modules/foo')
      expect(countLevels(paths)).toEqual({ root: 2, nested: 0 })
    })

    it('handles version conflicts in scoped packages', () => {
      const scopedV1 = pkg('@scope/pkg@1.0.0')
      const scopedV2 = pkg('@scope/pkg@2.0.0')
      const a = pkg('A', [scopedV1])
      const result = hoist([a, scopedV2])
      const paths = hoistedToPaths(result)

      expect(result.root.get('@scope/pkg')?.version).toBe('2.0.0')
      expect(paths).toContain('node_modules/A/node_modules/@scope/pkg')
    })
  })

  // #endregion

  // #region metadata tracking

  describe('metadata tracking', () => {
    it('maintains correct dependency counts', () => {
      const c = pkg('C')
      const b = pkg('B', [c])
      const a = pkg('A', [b, c])
      const result = hoist([a])

      expect(result.root.get('A')?.dependencyCount).toBe(2)
      expect(result.root.get('B')?.dependencyCount).toBe(1)
      expect(result.root.get('C')?.dependencyCount).toBe(0)
    })

    it('shared transitive at different depths is only hoisted once', () => {
      // A -> C -> D, B -> D  =>  D hoisted once
      const d = pkg('D')
      const c = pkg('C', [d])
      const a = pkg('A', [c])
      const b = pkg('B', [d])
      const result = hoist([a, b])
      const paths = hoistedToPaths(result)

      expect(paths.filter(p => p.endsWith('/D'))).toHaveLength(1)
    })
  })

  // #endregion

  // #region hoistedToPaths utility

  describe('hoistedToPaths', () => {
    it('returns sorted paths', () => {
      const c = pkg('C')
      const b = pkg('B')
      const a = pkg('A', [b, c])
      const result = hoist([a])
      const paths = hoistedToPaths(result)

      expect(paths).toEqual(paths.toSorted())
    })

    it('includes nested paths with full hierarchy', () => {
      const b2 = pkg('B@2.0.0')
      const b1 = pkg('B@1.0.0')
      const a = pkg('A', [b1])
      const result = hoist([a, b2])
      const paths = hoistedToPaths(result)

      expect(paths).toContain('node_modules/A')
      expect(paths).toContain('node_modules/A/node_modules/B')
      expect(paths).toContain('node_modules/B')
    })
  })

  // #endregion
})
