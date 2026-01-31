import { parseAst } from '@rolldown/browser/parseAst'
import { describe, expect, it } from 'vitest'

import { analyzeModule, type ModuleInfo } from './module-type'

function analyze(code: string): ModuleInfo {
  const ast = parseAst(code)
  return analyzeModule(ast)
}

describe('analyzeModule', () => {
  describe('ESM detection', () => {
    it('detects export const', () => {
      const info = analyze('export const foo = 1')
      expect(info.type).toBe('esm')
      expect(info.namedExports).toEqual(['foo'])
      expect(info.hasDefaultExport).toBe(false)
    })

    it('detects export default class', () => {
      const info = analyze('export default class {}')
      expect(info.type).toBe('esm')
      expect(info.hasDefaultExport).toBe(true)
    })

    it('detects export default function', () => {
      const info = analyze('export default function() {}')
      expect(info.type).toBe('esm')
      expect(info.hasDefaultExport).toBe(true)
    })

    it('detects export default expression', () => {
      const info = analyze('export default 42')
      expect(info.type).toBe('esm')
      expect(info.hasDefaultExport).toBe(true)
    })

    it('detects re-exports', () => {
      const info = analyze("export { a, b } from './mod'")
      expect(info.type).toBe('esm')
      expect(info.namedExports).toEqual(['a', 'b'])
    })

    it('detects star exports', () => {
      const info = analyze("export * from './mod'")
      expect(info.type).toBe('esm')
      // star exports don't add specific names
      expect(info.namedExports).toEqual([])
    })

    it('detects export { default } from as hasDefaultExport', () => {
      const info = analyze("export { default } from './mod'")
      expect(info.type).toBe('esm')
      expect(info.hasDefaultExport).toBe(true)
    })

    it('detects export { foo as default }', () => {
      const info = analyze("export { foo as default } from './mod'")
      expect(info.type).toBe('esm')
      expect(info.hasDefaultExport).toBe(true)
    })

    it('detects import statement', () => {
      const info = analyze("import foo from './mod'")
      expect(info.type).toBe('esm')
    })

    it('detects named imports', () => {
      const info = analyze("import { a, b } from './mod'")
      expect(info.type).toBe('esm')
    })

    it('detects import.meta.url', () => {
      const info = analyze('console.log(import.meta.url)')
      expect(info.type).toBe('esm')
    })

    it('detects multiple exports', () => {
      const info = analyze(`
				export const foo = 1;
				export const bar = 2;
				export function baz() {}
			`)
      expect(info.type).toBe('esm')
      expect(info.namedExports).toEqual(['foo', 'bar', 'baz'])
    })

    it('detects export function', () => {
      const info = analyze('export function foo() {}')
      expect(info.type).toBe('esm')
      expect(info.namedExports).toEqual(['foo'])
    })

    it('detects export class', () => {
      const info = analyze('export class Foo {}')
      expect(info.type).toBe('esm')
      expect(info.namedExports).toEqual(['Foo'])
    })

    it('does not count dynamic import alone as ESM', () => {
      const info = analyze("import('./dynamic')")
      expect(info.type).toBe('unknown')
    })
  })

  describe('CJS detection', () => {
    it('detects exports.foo assignment', () => {
      const info = analyze('exports.foo = 1')
      expect(info.type).toBe('cjs')
      expect(info.namedExports).toEqual(['foo'])
    })

    it('detects module.exports.bar assignment', () => {
      const info = analyze('module.exports.bar = 2')
      expect(info.type).toBe('cjs')
      expect(info.namedExports).toEqual(['bar'])
    })

    it('detects module.exports = { a, b }', () => {
      const info = analyze('module.exports = { a, b }')
      expect(info.type).toBe('cjs')
      expect(info.namedExports).toEqual(['a', 'b'])
    })

    it('detects module.exports = { a: 1, b: 2 }', () => {
      const info = analyze('module.exports = { a: 1, b: 2 }')
      expect(info.type).toBe('cjs')
      expect(info.namedExports).toEqual(['a', 'b'])
    })

    it('detects Object.defineProperty(exports, "x", ...)', () => {
      const info = analyze('Object.defineProperty(exports, "x", { value: 1 })')
      expect(info.type).toBe('cjs')
      expect(info.namedExports).toEqual(['x'])
    })

    it('detects Object.defineProperty(module.exports, "y", ...)', () => {
      const info = analyze('Object.defineProperty(module.exports, "y", { get: () => 1 })')
      expect(info.type).toBe('cjs')
      expect(info.namedExports).toEqual(['y'])
    })

    it('collects multiple CJS exports', () => {
      const info = analyze(`
				exports.foo = 1;
				exports.bar = 2;
				module.exports.baz = 3;
			`)
      expect(info.type).toBe('cjs')
      expect(info.namedExports).toEqual(['foo', 'bar', 'baz'])
    })

    it('detects module.exports = require(...) re-export', () => {
      const info = analyze("module.exports = require('./other')")
      expect(info.type).toBe('cjs')
      // can't know exports statically from re-export
      expect(info.namedExports).toEqual([])
    })

    it('detects conditional require re-export (React pattern)', () => {
      const info = analyze(`
				'use strict';
				if (process.env.NODE_ENV === 'production') {
					module.exports = require('./cjs/react.production.js');
				} else {
					module.exports = require('./cjs/react.development.js');
				}
			`)
      expect(info.type).toBe('cjs')
    })

    it('detects conditional require with block statements', () => {
      const info = analyze(`
				if (condition) {
					module.exports = require('./a');
				} else {
					module.exports = require('./b');
				}
			`)
      expect(info.type).toBe('cjs')
    })

    it('detects conditional require without braces', () => {
      const info = analyze(`
				if (condition)
					module.exports = require('./a');
				else
					module.exports = require('./b');
			`)
      expect(info.type).toBe('cjs')
    })
  })

  describe('unknown detection', () => {
    it('returns unknown for empty file', () => {
      const info = analyze('')
      expect(info.type).toBe('unknown')
      expect(info.namedExports).toEqual([])
      expect(info.hasDefaultExport).toBe(false)
    })

    it('returns unknown for side-effects only', () => {
      const info = analyze("console.log('side effect')")
      expect(info.type).toBe('unknown')
    })

    it('returns unknown for only dynamic imports', () => {
      const info = analyze("const mod = import('./dynamic')")
      expect(info.type).toBe('unknown')
    })

    it('returns unknown for iife', () => {
      const info = analyze('(function() { console.log("hi"); })()')
      expect(info.type).toBe('unknown')
    })
  })

  describe('mixed scenarios', () => {
    it('ESM takes precedence over CJS patterns', () => {
      // some files might have both patterns (e.g., dual builds)
      const info = analyze(`
				export const foo = 1;
				exports.bar = 2;
			`)
      expect(info.type).toBe('esm')
      // ESM export is captured, CJS is ignored when ESM detected first
      expect(info.namedExports).toContain('foo')
    })
  })
})
