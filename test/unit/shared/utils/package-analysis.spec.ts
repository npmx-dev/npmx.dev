import { describe, expect, it } from 'vitest'
import { analyzePackage, detectTypesStatus } from '#shared/utils/package-analysis'

describe('detectTypesStatus', () => {
  it('detects included types from types field', () => {
    expect(detectTypesStatus({ types: './index.d.ts' })).toEqual({ kind: 'included' })
  })

  it('detects included types from typings field', () => {
    expect(detectTypesStatus({ typings: './index.d.ts' })).toEqual({ kind: 'included' })
  })

  it('detects included types from exports with types condition', () => {
    expect(
      detectTypesStatus({
        exports: {
          '.': {
            types: './index.d.ts',
            default: './index.js',
          },
        },
      }),
    ).toEqual({ kind: 'included' })
  })

  it('detects @types package when provided', () => {
    expect(detectTypesStatus({}, { packageName: '@types/lodash' })).toEqual({
      kind: '@types',
      packageName: '@types/lodash',
    })
  })

  it('includes deprecation info in @types detection', () => {
    expect(
      detectTypesStatus({}, { packageName: '@types/lodash', deprecated: 'Now included in lodash' }),
    ).toEqual({
      kind: '@types',
      packageName: '@types/lodash',
      deprecated: 'Now included in lodash',
    })
  })

  it('returns none when no types detected', () => {
    expect(detectTypesStatus({})).toEqual({ kind: 'none' })
  })

  it('detects included types when matching declaration file exists for entry point', () => {
    expect(
      detectTypesStatus(
        { type: 'module', exports: { '.': './dist/index.mjs' } },
        undefined,
        new Set(['dist/index.mjs', 'dist/index.d.mts']),
      ),
    ).toEqual({ kind: 'included' })
  })

  it('does not detect types from unrelated .d.ts files in the package', () => {
    expect(
      detectTypesStatus(
        { type: 'module', exports: { '.': './dist/index.mjs' } },
        undefined,
        new Set(['dist/index.mjs', 'env.d.ts', 'shims-vue.d.ts']),
      ),
    ).toEqual({ kind: 'none' })
  })
})

describe('detectTypesStatus implicit types from entry points', () => {
  it('finds .d.mts matching .mjs export entry point', () => {
    expect(
      detectTypesStatus(
        { type: 'module', exports: { '.': './dist/index.mjs' } },
        undefined,
        new Set(['dist/index.d.mts']),
      ),
    ).toEqual({ kind: 'included' })
  })

  it('finds .d.cts matching .cjs export entry point', () => {
    expect(
      detectTypesStatus(
        { exports: { '.': { require: './dist/index.cjs' } } },
        undefined,
        new Set(['dist/index.d.cts']),
      ),
    ).toEqual({ kind: 'included' })
  })

  it('finds .d.ts matching .js export entry point', () => {
    expect(
      detectTypesStatus(
        { exports: { '.': './dist/index.js' } },
        undefined,
        new Set(['dist/index.d.ts']),
      ),
    ).toEqual({ kind: 'included' })
  })

  it('finds .d.mts matching .mjs main entry point', () => {
    expect(
      detectTypesStatus(
        { type: 'module', main: 'dist/index.mjs' },
        undefined,
        new Set(['dist/index.d.mts']),
      ),
    ).toEqual({ kind: 'included' })
  })

  it('finds .d.ts matching .js module entry point', () => {
    expect(
      detectTypesStatus({ module: './dist/index.js' }, undefined, new Set(['dist/index.d.ts'])),
    ).toEqual({ kind: 'included' })
  })

  it('returns none when no declaration file matches any entry point', () => {
    expect(
      detectTypesStatus(
        { type: 'module', exports: { '.': './dist/index.mjs' } },
        undefined,
        new Set(['dist/other.d.mts', 'types/env.d.ts']),
      ),
    ).toEqual({ kind: 'none' })
  })
})

describe('analyzePackage with files (implicit types)', () => {
  it('detects included types when matching declaration file exists for entry point', () => {
    const pkg = { type: 'module' as const, exports: { '.': './dist/index.mjs' } }
    const files = new Set(['dist/index.mjs', 'dist/index.d.mts'])
    const result = analyzePackage(pkg, { files })
    expect(result.types).toEqual({ kind: 'included' })
  })

  it('returns none when no declaration file matches entry point', () => {
    const pkg = { type: 'module' as const, exports: { '.': './dist/index.mjs' } }
    const files = new Set(['dist/index.mjs'])
    const result = analyzePackage(pkg, { files })
    expect(result.types).toEqual({ kind: 'none' })
  })

  it('returns none when only unrelated .d.ts files exist', () => {
    const pkg = { type: 'module' as const, exports: { '.': './dist/index.mjs' } }
    const files = new Set(['dist/index.mjs', 'env.d.ts'])
    const result = analyzePackage(pkg, { files })
    expect(result.types).toEqual({ kind: 'none' })
  })
})

describe('analyzePackage', () => {
  it('analyzes Vue package correctly', () => {
    const result = analyzePackage({
      name: 'vue',
      type: undefined,
      main: 'index.js',
      module: 'dist/vue.runtime.esm-bundler.js',
      types: 'dist/vue.d.ts',
      exports: {
        '.': {
          import: './dist/vue.runtime.esm-bundler.js',
          require: './index.js',
        },
      },
    })

    expect(result.moduleFormat).toBe('dual')
    expect(result.types).toEqual({ kind: 'included' })
  })

  it('analyzes ESM-only package correctly', () => {
    const result = analyzePackage({
      name: 'execa',
      type: 'module',
      exports: {
        types: './index.d.ts',
        default: './index.js',
      },
    })

    expect(result.moduleFormat).toBe('esm')
    expect(result.types).toEqual({ kind: 'included' })
  })

  it('includes engines when present', () => {
    const result = analyzePackage({
      name: 'test',
      main: 'index.js',
      engines: {
        bun: '>=1.0.0',
        node: '>=18',
        npm: '>=9',
      },
    })

    expect(result.engines).toEqual({
      bun: '>=1.0.0',
      node: '>=18',
      npm: '>=9',
    })
  })

  it('detects @types package when typesPackage info is provided', () => {
    const result = analyzePackage(
      { name: 'express', main: 'index.js' },
      { typesPackage: { packageName: '@types/express' } },
    )

    expect(result.types).toEqual({ kind: '@types', packageName: '@types/express' })
  })

  it('includes deprecation info for @types package', () => {
    const result = analyzePackage(
      { name: 'express', main: 'index.js' },
      { typesPackage: { packageName: '@types/express', deprecated: 'Use included types instead' } },
    )

    expect(result.types).toEqual({
      kind: '@types',
      packageName: '@types/express',
      deprecated: 'Use included types instead',
    })
  })

  it('includes createPackage when provided', () => {
    const result = analyzePackage(
      { name: 'vite', main: 'index.js' },
      { createPackage: { packageName: 'create-vite' } },
    )

    expect(result.createPackage).toEqual({ packageName: 'create-vite' })
  })

  it('includes deprecation info for createPackage', () => {
    const result = analyzePackage(
      { name: 'foo', main: 'index.js' },
      { createPackage: { packageName: 'create-foo', deprecated: 'Use different tool' } },
    )

    expect(result.createPackage).toEqual({
      packageName: 'create-foo',
      deprecated: 'Use different tool',
    })
  })
})
