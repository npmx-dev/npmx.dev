import { describe, expect, it } from 'vitest'
import type { PackageFileTree } from '../../../../shared/types'
import {
  createImportResolver,
  flattenFileTree,
  resolveRelativeImport,
} from '../../../../server/utils/import-resolver'

describe('flattenFileTree', () => {
  it('flattens nested trees into a file set', () => {
    const tree: PackageFileTree[] = [
      {
        name: 'dist',
        path: 'dist',
        type: 'directory',
        children: [
          { name: 'index.js', path: 'dist/index.js', type: 'file', size: 10 },
          {
            name: 'utils',
            path: 'dist/utils',
            type: 'directory',
            children: [{ name: 'format.js', path: 'dist/utils/format.js', type: 'file', size: 5 }],
          },
        ],
      },
    ]

    const files = flattenFileTree(tree)

    expect(files.has('dist/index.js')).toBe(true)
    expect(files.has('dist/utils/format.js')).toBe(true)
    expect(files.has('dist/utils')).toBe(false)
  })

  it('returns an empty set for an empty tree', () => {
    const files = flattenFileTree([])
    expect(files.size).toBe(0)
  })

  it('includes root-level files', () => {
    const tree: PackageFileTree[] = [
      { name: 'index.js', path: 'index.js', type: 'file', size: 5 },
      { name: 'cli.js', path: 'cli.js', type: 'file', size: 3 },
    ]

    const files = flattenFileTree(tree)

    expect(files.has('index.js')).toBe(true)
    expect(files.has('cli.js')).toBe(true)
  })
})

describe('resolveRelativeImport', () => {
  it('resolves a relative import with extension priority for JS files', () => {
    const files = new Set<string>(['dist/utils.js', 'dist/utils.ts'])
    const resolved = resolveRelativeImport('./utils', 'dist/index.js', files)

    expect(resolved?.path).toBe('dist/utils.js')
  })

  it('resolves a relative import with extension priority for TS files', () => {
    const files = new Set<string>(['src/utils.ts', 'src/utils.js'])
    const resolved = resolveRelativeImport('./utils', 'src/index.ts', files)

    expect(resolved?.path).toBe('src/utils.ts')
  })

  it('resolves a relative import to .d.ts when source is a declaration file', () => {
    const files = new Set<string>(['dist/types.d.ts', 'dist/types.ts'])
    const resolved = resolveRelativeImport('./types', 'dist/index.d.ts', files)

    expect(resolved?.path).toBe('dist/types.d.ts')
  })

  it('resolves an exact extension match', () => {
    const files = new Set<string>(['src/utils.ts', 'src/utils.js'])
    const resolved = resolveRelativeImport('./utils.ts', 'src/index.ts', files)

    expect(resolved?.path).toBe('src/utils.ts')
  })

  it('resolves a quoted specifier', () => {
    const files = new Set<string>(['dist/utils.js'])
    const resolved = resolveRelativeImport("'./utils'", 'dist/index.js', files)

    expect(resolved?.path).toBe('dist/utils.js')
  })

  it('resolves a relative import with extension priority for MTS files', () => {
    const files = new Set<string>(['src/utils.mts', 'src/utils.mjs', 'src/utils.ts'])
    const resolved = resolveRelativeImport('./utils', 'src/index.mts', files)

    expect(resolved?.path).toBe('src/utils.mts')
  })

  it('resolves a relative import with extension priority for MJS files', () => {
    const files = new Set<string>(['dist/utils.mjs', 'dist/utils.js'])
    const resolved = resolveRelativeImport('./utils', 'dist/index.mjs', files)

    expect(resolved?.path).toBe('dist/utils.mjs')
  })

  it('resolves a relative import with extension priority for CTS files', () => {
    const files = new Set<string>(['src/utils.cts', 'src/utils.cjs', 'src/utils.ts'])
    const resolved = resolveRelativeImport('./utils', 'src/index.cts', files)

    expect(resolved?.path).toBe('src/utils.cts')
  })

  it('resolves a relative import with extension priority for CJS files', () => {
    const files = new Set<string>(['dist/utils.cjs', 'dist/utils.js'])
    const resolved = resolveRelativeImport('./utils', 'dist/index.cjs', files)

    expect(resolved?.path).toBe('dist/utils.cjs')
  })

  it('resolves directory imports to index files', () => {
    const files = new Set<string>(['dist/components/index.js'])
    const resolved = resolveRelativeImport('./components', 'dist/index.js', files)

    expect(resolved?.path).toBe('dist/components/index.js')
  })

  it('resolves parent directory paths', () => {
    const files = new Set<string>(['dist/shared/helpers.js'])
    const resolved = resolveRelativeImport('../shared/helpers', 'dist/pages/home.js', files)

    expect(resolved?.path).toBe('dist/shared/helpers.js')
  })

  it('returns null when the path would go above the package root', () => {
    const files = new Set<string>(['dist/index.js'])
    const resolved = resolveRelativeImport('../../outside', 'dist/index.js', files)

    expect(resolved).toBeNull()
  })

  it('returns null for non-relative imports', () => {
    const files = new Set<string>(['dist/utils.js'])
    const resolved = resolveRelativeImport('react', 'dist/index.js', files)

    expect(resolved).toBeNull()
  })

  it('returns null when no matching file is found', () => {
    const files = new Set<string>(['dist/utils.js'])
    const resolved = resolveRelativeImport('./missing', 'dist/index.js', files)

    expect(resolved).toBeNull()
  })
})

describe('createImportResolver', () => {
  it('creates a resolver that returns code browser URLs', () => {
    const files = new Set<string>(['dist/utils.js'])
    const resolver = createImportResolver(files, 'dist/index.js', 'pkg-name', '1.2.3')

    const url = resolver('./utils')

    expect(url).toBe('/code/pkg-name/v/1.2.3/dist/utils.js')
  })

  it('returns null when the import cannot be resolved', () => {
    const files = new Set<string>(['dist/utils.js'])
    const resolver = createImportResolver(files, 'dist/index.js', 'pkg-name', '1.2.3')

    const url = resolver('./missing')

    expect(url).toBeNull()
  })

  it('handles scoped package names in URLs', () => {
    const files = new Set<string>(['dist/utils.js'])
    const resolver = createImportResolver(files, 'dist/index.js', '@scope/pkg', '1.2.3')

    const url = resolver('./utils')

    expect(url).toBe('/code/@scope/pkg/v/1.2.3/dist/utils.js')
  })
})
