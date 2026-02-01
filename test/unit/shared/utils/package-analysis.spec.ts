import { describe, expect, it } from 'vitest'
import {
  analyzePackage,
  detectModuleFormat,
  detectTypesStatus,
  getCreatePackageName,
  getCreateShortName,
  getTypesPackageName,
  hasBuiltInTypes,
} from '../../../../shared/utils/package-analysis'

describe('detectModuleFormat', () => {
  it('detects ESM from type: module', () => {
    expect(detectModuleFormat({ type: 'module', main: 'index.js' })).toBe('esm')
  })

  it('detects CJS from type: commonjs', () => {
    expect(detectModuleFormat({ type: 'commonjs', main: 'index.js' })).toBe('cjs')
  })

  it('detects CJS when no type field (default)', () => {
    expect(detectModuleFormat({ main: 'index.js' })).toBe('cjs')
  })

  it('detects dual from module + main fields', () => {
    expect(detectModuleFormat({ module: 'index.mjs', main: 'index.js' })).toBe('dual')
  })

  it('detects ESM from module field without main', () => {
    expect(detectModuleFormat({ module: 'index.mjs' })).toBe('esm')
  })

  it('detects dual from exports with import + require conditions', () => {
    expect(
      detectModuleFormat({
        exports: {
          '.': {
            import: './index.mjs',
            require: './index.cjs',
          },
        },
      }),
    ).toBe('dual')
  })

  it('detects ESM from exports with only import condition', () => {
    expect(
      detectModuleFormat({
        type: 'module',
        exports: {
          '.': {
            import: './index.js',
          },
        },
      }),
    ).toBe('esm')
  })

  it('detects CJS from exports with only require condition', () => {
    expect(
      detectModuleFormat({
        exports: {
          '.': {
            require: './index.cjs',
          },
        },
      }),
    ).toBe('cjs')
  })

  it('detects dual from nested exports with both conditions', () => {
    expect(
      detectModuleFormat({
        exports: {
          '.': {
            import: {
              types: './dist/index.d.mts',
              default: './dist/index.mjs',
            },
            require: {
              types: './dist/index.d.ts',
              default: './dist/index.cjs',
            },
          },
        },
      }),
    ).toBe('dual')
  })

  it('returns cjs for empty package (npm default)', () => {
    // npm treats packages without type field as CommonJS
    expect(detectModuleFormat({})).toBe('cjs')
  })
})

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
})

describe('getTypesPackageName', () => {
  it('handles unscoped package', () => {
    expect(getTypesPackageName('lodash')).toBe('@types/lodash')
  })

  it('handles scoped package', () => {
    expect(getTypesPackageName('@nuxt/kit')).toBe('@types/nuxt__kit')
  })
})

describe('hasBuiltInTypes', () => {
  it('returns true when types field is present', () => {
    expect(hasBuiltInTypes({ types: './index.d.ts' })).toBe(true)
  })

  it('returns true when typings field is present', () => {
    expect(hasBuiltInTypes({ typings: './index.d.ts' })).toBe(true)
  })

  it('returns true when exports has types condition', () => {
    expect(
      hasBuiltInTypes({
        exports: {
          '.': {
            types: './index.d.ts',
            default: './index.js',
          },
        },
      }),
    ).toBe(true)
  })

  it('returns false when no types are present', () => {
    expect(hasBuiltInTypes({ main: 'index.js' })).toBe(false)
  })

  it('returns false for empty package', () => {
    expect(hasBuiltInTypes({})).toBe(false)
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
        node: '>=18',
        npm: '>=9',
      },
    })

    expect(result.engines).toEqual({ node: '>=18', npm: '>=9' })
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

describe('getCreatePackageName', () => {
  it('handles unscoped package', () => {
    expect(getCreatePackageName('vite')).toBe('create-vite')
  })

  it('handles scoped package', () => {
    expect(getCreatePackageName('@nuxt/app')).toBe('@nuxt/create-app')
  })

  it('handles single-word package', () => {
    expect(getCreatePackageName('next')).toBe('create-next')
  })

  it('handles hyphenated package', () => {
    expect(getCreatePackageName('solid-js')).toBe('create-solid-js')
  })
})

describe('getCreateShortName', () => {
  it('extracts name from unscoped create-* package', () => {
    expect(getCreateShortName('create-vite')).toBe('vite')
  })

  it('extracts name from scoped create-* package', () => {
    expect(getCreateShortName('@vue/create-app')).toBe('app')
  })

  it('returns full name if not a create-* package', () => {
    expect(getCreateShortName('vite')).toBe('vite')
  })

  it('handles scoped package without create- prefix', () => {
    expect(getCreateShortName('@scope/foo')).toBe('foo')
  })

  it('extracts name from create-next-app style packages', () => {
    expect(getCreateShortName('create-next-app')).toBe('next-app')
  })
})
