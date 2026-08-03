import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)

const mockResolveDependencyTree = vi.fn()
vi.stubGlobal('resolveDependencyTree', mockResolveDependencyTree)

const { calculateInstallSize } = await import('#server/utils/install-size')

describe('install-size', () => {
  it('excludes native optional dependencies from total size and dependency count', async () => {
    mockResolveDependencyTree.mockResolvedValue(
      new Map([
        ['root@1.0.0', { name: 'root', version: '1.0.0', size: 100 }],
        ['normal-dep@1.0.0', { name: 'normal-dep', version: '1.0.0', size: 50 }],
        [
          'native-dep@1.0.0',
          { name: 'native-dep', version: '1.0.0', size: 1000, optional: true, isNative: true },
        ],
        [
          'native-child-dep@1.0.0',
          {
            name: 'native-child-dep',
            version: '1.0.0',
            size: 2000,
            optional: true,
            isNative: true,
          },
        ],
      ]),
    )

    const result = await calculateInstallSize('root', '1.0.0')

    // Normal dep + root self size = 50 + 100 = 150
    // The native deps (3000 total) should be excluded
    expect(result.totalSize).toBe(150)

    // Only 1 normal dependency should be counted
    expect(result.dependencyCount).toBe(1)

    // All dependencies should still be returned in the list
    expect(result.dependencies).toHaveLength(3)
  })
})
