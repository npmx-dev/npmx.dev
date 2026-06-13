import { describe, expect, it } from 'vitest'
import type { PackageFileTree } from '#shared/types'
import {
  createImportResolver,
  flattenFileTree,
  resolveAliasToDir,
  resolvePackageSelfImport,
  resolveInternalImport,
  resolveRelativeImport,
  type InternalImportTarget,
} from '#server/utils/import-resolver'

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

  it('ignores directory nodes without children', () => {
    const tree: PackageFileTree[] = [
      { name: 'empty', path: 'empty', type: 'directory', children: undefined },
      { name: 'readme.md', path: 'readme.md', type: 'file', size: 1 },
    ]

    const files = flattenFileTree(tree)

    expect(files.has('readme.md')).toBe(true)
    expect(files.has('empty')).toBe(false)
  })
})

describe('resolveAliasToDir', () => {
  it('returns the deepest matching alias directory', () => {
    expect(resolveAliasToDir('#app', './src/app/generated/app/index.js')).toBe(
      './src/app/generated/app',
    )
  })

  it('returns the full path for root aliases', () => {
    expect(resolveAliasToDir('#', './src/app/index.js')).toBe('./src/app/index.js')
  })

  it('returns null when the alias does not match a path segment', () => {
    expect(resolveAliasToDir('#components', './src/app/index.js')).toBeNull()
  })

  it('returns null for unsupported alias prefixes', () => {
    expect(resolveAliasToDir('components', './src/components/index.js')).toBeNull()
  })

  it('returns null when filePath is missing', () => {
    expect(resolveAliasToDir('#app', null)).toBeNull()
    expect(resolveAliasToDir('#app', undefined)).toBeNull()
  })

  it('normalizes #/foo style aliases', () => {
    expect(resolveAliasToDir('#/dist', 'root/dist/pkg/index.js')).toBe('root/dist')
  })

  it('normalizes $/foo style aliases', () => {
    expect(resolveAliasToDir('$/dist', 'root/dist/pkg/index.js')).toBe('root/dist')
  })

  it('returns null when the file path trims to empty', () => {
    expect(resolveAliasToDir('#', '///')).toBeNull()
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

  it('uses default extension priority for non-js/ts sources such as .vue', () => {
    const files = new Set<string>(['src/helper.ts', 'src/helper.js'])
    const resolved = resolveRelativeImport('./helper', 'src/Component.vue', files)

    expect(resolved?.path).toBe('src/helper.ts')
  })

  it('prefers declaration peers when resolving from .d.mts', () => {
    const files = new Set<string>(['types/mod.d.mts'])
    const resolved = resolveRelativeImport('./mod', 'types/index.d.mts', files)

    expect(resolved?.path).toBe('types/mod.d.mts')
  })

  it('resolves jsx shims when matching a tsx source and only jsx exists on disk', () => {
    const files = new Set<string>(['ui/Box.jsx'])
    const resolved = resolveRelativeImport('./Box', 'ui/App.tsx', files)

    expect(resolved?.path).toBe('ui/Box.jsx')
  })
})

describe('createImportResolver', () => {
  it('creates a resolver that returns code browser URLs', () => {
    const files = new Set<string>(['dist/utils.js'])
    const resolver = createImportResolver(files, 'dist/index.js', 'pkg-name', '1.2.3')

    const url = resolver('./utils')

    expect(url).toBe('/package-code/pkg-name/v/1.2.3/dist/utils.js')
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

    expect(url).toBe('/package-code/@scope/pkg/v/1.2.3/dist/utils.js')
  })

  it('resolves package imports aliases to code browser URLs', () => {
    const files = new Set<string>(['dist/app/nuxt.js'])
    const resolver = createImportResolver(files, 'dist/index.js', 'nuxt', '4.3.1', {
      '#app/nuxt': './dist/app/nuxt.js',
    })

    const url = resolver('#app/nuxt')

    expect(url).toBe('/package-code/nuxt/v/4.3.1/dist/app/nuxt.js')
  })

  it('resolves self package subpath imports to code browser URLs', () => {
    const files = new Set<string>(['find.mjs', 'walk.mjs'])
    const resolver = createImportResolver(files, 'find.mjs', 'empathic', '2.0.0', undefined, {
      './walk': { import: './walk.mjs' },
    })

    const url = resolver('empathic/walk')

    expect(url).toBe('/package-code/empathic/v/2.0.0/walk.mjs')
  })
})

describe('resolveInternalImport', () => {
  it('resolves exact imports map matches to files in the package', () => {
    const files = new Set<string>(['dist/app/nuxt.js'])

    const resolved = resolveInternalImport(
      '#app/nuxt',
      'dist/index.js',
      {
        '#app/nuxt': './dist/app/nuxt.js',
      },
      files,
    )

    expect(resolved?.path).toBe('dist/app/nuxt.js')
  })

  it('supports import condition objects', () => {
    const files = new Set<string>(['dist/app/nuxt.js'])

    const resolved = resolveInternalImport(
      '#app/nuxt',
      'dist/index.js',
      {
        '#app/nuxt': { import: './dist/app/nuxt.js' },
      },
      files,
    )

    expect(resolved?.path).toBe('dist/app/nuxt.js')
  })

  it('returns null when the target file does not exist', () => {
    const files = new Set<string>(['dist/app/index.js'])

    const resolved = resolveInternalImport(
      '#app/nuxt',
      'dist/index.js',
      {
        '#app/nuxt': './dist/app/nuxt.js',
      },
      files,
    )

    expect(resolved).toBeNull()
  })

  it('resolves prefix matches with extension resolution via guessInternalImportTarget', () => {
    const files = new Set<string>(['dist/app/components/button.js'])

    const resolved = resolveInternalImport(
      '#app/components/button.js',
      'dist/index.js',
      {
        '#app': './dist/app/index.js',
      },
      files,
    )

    expect(resolved?.path).toBe('dist/app/components/button.js')
  })

  it('resolves file that could not found in the files', () => {
    const files = new Set<string>(['dist/app/index.js'])

    const resolved = resolveInternalImport(
      '#app/components/button.js',
      'dist/index.js',
      {
        '#app': './dist/app/index.js',
      },
      files,
    )

    expect(resolved).toBeNull()
  })

  it('resolves file that prefix is "~/"', () => {
    const files = new Set<string>(['dist/app/components/button.js'])

    const resolved = resolveInternalImport(
      '~/app/components/button.js',
      'dist/index.js',
      {
        '~/app': './dist/app/index.js',
      },
      files,
    )

    expect(resolved?.path).toBe('dist/app/components/button.js')
  })

  it('resolves file that prefix is "@/"', () => {
    const files = new Set<string>(['dist/app/components/button.js'])

    const resolved = resolveInternalImport(
      '@/app/components/button.js',
      'dist/index.js',
      {
        '@/app': './dist/app/index.js',
      },
      files,
    )

    expect(resolved?.path).toBe('dist/app/components/button.js')
  })

  it('resolves file that prefix is "$/"', () => {
    const files = new Set<string>(['dist/app/components/button.js'])

    const resolved = resolveInternalImport(
      '$/app/components/button.js',
      'dist/index.js',
      {
        '$/app': './dist/app/index.js',
      },
      files,
    )

    expect(resolved?.path).toBe('dist/app/components/button.js')
  })

  it('resolves guessed alias targets to directory index files', () => {
    const files = new Set<string>(['dist/app/components/index.js'])

    const resolved = resolveInternalImport(
      '#app/components',
      'dist/index.js',
      {
        '#app': './dist/app/index.js',
      },
      files,
    )

    expect(resolved?.path).toBe('dist/app/components/index.js')
  })

  it('infers extensions for exact import map targets without a file suffix', () => {
    const files = new Set<string>(['src/a.ts'])

    const resolved = resolveInternalImport('#token', 'index.ts', { '#token': './src/a' }, files)

    expect(resolved?.path).toBe('src/a.ts')
  })

  it('returns null when imports map is missing', () => {
    const files = new Set<string>(['dist/a.js'])

    expect(resolveInternalImport('#x', 'dist/index.js', undefined, files)).toBeNull()
  })

  it('returns null when specifier is not an internal alias style', () => {
    const files = new Set<string>(['dist/a.js'])

    expect(
      resolveInternalImport('lodash', 'dist/index.js', { '#a': './dist/a.js' }, files),
    ).toBeNull()
  })

  it('returns null when the mapped target is not package-relative', () => {
    const files = new Set<string>([])

    const resolved = resolveInternalImport(
      '#pkg',
      'index.js',
      { '#pkg': '/absolute/outside.js' },
      files,
    )

    expect(resolved).toBeNull()
  })

  it('returns null for guessed paths with extension-like segments that do not exist', () => {
    const files = new Set<string>(['dist/app/index.js'])

    const resolved = resolveInternalImport(
      '#app/missing.vue',
      'dist/index.js',
      { '#app': './dist/app/index.js' },
      files,
    )

    expect(resolved).toBeNull()
  })

  it('strips quotes from internal specifiers before resolving', () => {
    const files = new Set<string>(['dist/app/nuxt.js'])

    const resolved = resolveInternalImport(
      "'#app/nuxt'",
      'dist/index.js',
      { '#app/nuxt': './dist/app/nuxt.js' },
      files,
    )

    expect(resolved?.path).toBe('dist/app/nuxt.js')
  })

  it('falls back to default import condition when import field is absent', () => {
    const files = new Set<string>(['dist/legacy.js'])

    const resolved = resolveInternalImport(
      '#legacy',
      'dist/index.js',
      { '#legacy': { default: './dist/legacy.js' } },
      files,
    )

    expect(resolved?.path).toBe('dist/legacy.js')
  })

  it('ignores non-string import map entries', () => {
    const files = new Set<string>(['dist/a.js'])

    const resolved = resolveInternalImport(
      '#bad',
      'dist/index.js',
      { '#bad': { import: 1 } as unknown as InternalImportTarget },
      files,
    )

    expect(resolved).toBeNull()
  })

  it('resolves #/ slash-variant specifier against a plain #app imports key', () => {
    const files = new Set<string>(['dist/app/components/Button.vue'])

    const resolved = resolveInternalImport(
      '#/app/components/Button.vue',
      'dist/index.js',
      { '#app': './dist/app/index.js' },
      files,
    )

    expect(resolved?.path).toBe('dist/app/components/Button.vue')
  })
})

describe('resolvePackageSelfImport', () => {
  it('resolves the package root using the dot export', () => {
    const files = new Set<string>(['index.mjs'])

    const resolved = resolvePackageSelfImport(
      'empathic',
      'empathic',
      {
        '.': { import: './index.mjs' },
      },
      'find.mjs',
      files,
    )

    expect(resolved?.path).toBe('index.mjs')
  })

  it('resolves package self subpath imports using exports', () => {
    const files = new Set<string>(['find.mjs', 'walk.mjs'])

    const resolved = resolvePackageSelfImport(
      'empathic/walk',
      'empathic',
      {
        './walk': { import: './walk.mjs' },
      },
      'find.mjs',
      files,
    )

    expect(resolved?.path).toBe('walk.mjs')
  })

  it('resolves package self subpath imports to directory index files', () => {
    const files = new Set<string>(['walk/index.mjs'])

    const resolved = resolvePackageSelfImport(
      'empathic/walk',
      'empathic',
      {
        './walk': { import: './walk' },
      },
      'find.mjs',
      files,
    )

    expect(resolved?.path).toBe('walk/index.mjs')
  })

  it('returns null when the specifier is not for the current package', () => {
    const files = new Set<string>(['walk.mjs'])

    const resolved = resolvePackageSelfImport(
      'other-package/walk',
      'empathic',
      {
        './walk': { import: './walk.mjs' },
      },
      'find.mjs',
      files,
    )

    expect(resolved).toBeNull()
  })

  it('falls back to file-tree based self subpath resolution when exports are unavailable', () => {
    const files = new Set<string>(['find.mjs', 'walk.mjs'])

    const resolved = resolvePackageSelfImport(
      'empathic/walk',
      'empathic',
      undefined,
      'find.mjs',
      files,
    )

    expect(resolved?.path).toBe('walk.mjs')
  })

  it('returns null when neither exports nor fallback resolution can find a file', () => {
    const files = new Set<string>(['find.mjs'])

    const resolved = resolvePackageSelfImport(
      'empathic/missing',
      'empathic',
      {
        './missing': { import: './missing' },
      },
      'find.mjs',
      files,
    )

    expect(resolved).toBeNull()
  })

  it('uses the require export condition when import/default are absent', () => {
    const files = new Set<string>(['lib.node.cjs'])

    const resolved = resolvePackageSelfImport(
      'pkg/native',
      'pkg',
      { './native': { require: './lib.node.cjs' } },
      'index.js',
      files,
    )

    expect(resolved?.path).toBe('lib.node.cjs')
  })

  it('uses the types export condition as a last resort', () => {
    const files = new Set<string>(['types.d.ts'])

    const resolved = resolvePackageSelfImport(
      'pkg/types',
      'pkg',
      { './types': { types: './types.d.ts' } },
      'index.d.ts',
      files,
    )

    expect(resolved?.path).toBe('types.d.ts')
  })

  it('returns null when resolvePath rejects unsafe targets', () => {
    const files = new Set<string>(['secret.js'])

    const resolved = resolvePackageSelfImport(
      'pkg/leak',
      'pkg',
      { './leak': { import: '../secret.js' } },
      'index.js',
      files,
    )

    expect(resolved).toBeNull()
  })

  it('strips quotes before normalizing self-import specifiers', () => {
    const files = new Set<string>(['walk.mjs'])

    const resolved = resolvePackageSelfImport(
      "'empathic/walk'",
      'empathic',
      { './walk': { import: './walk.mjs' } },
      'find.mjs',
      files,
    )

    expect(resolved?.path).toBe('walk.mjs')
  })
})
