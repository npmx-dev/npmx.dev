import { doc } from '@deno/doc'
import type { TsTypeLiteralDef } from '@deno/doc'
import { describe, expect, expectTypeOf, it } from 'vite-plus/test'
import { formatParams, formatType, getNodeSignature } from '#server/utils/docs/format'
import {
  buildSymbolLookup,
  flattenSymbols,
  getEnumMembers,
  findUnrecognizedShapes,
  getMethodDef,
  mergeOverloads,
} from '#server/utils/docs/processing'
import { renderDocNodes } from '#server/utils/docs/render'

const SOURCE = `
export function greet(name: string): string
export function greet(name: string, loud: boolean): string
export function greet(name: string, loud?: boolean): string { return name }
export type Pair = [string, number]
export type Both = { a: string } & { b: number }
export type Choice = 'a' | 'b'
export interface Options { level: number; reset(): void }
export class Store {
  static create(): Store { return new Store() }
  get size(): number { return 0 }
  set(key: string): void {}
}
export enum Level { Low, High }
export class Base<T> { value!: T }
export class Box<T, U extends string = string> extends Base<T> implements Iterable<T> {
  map<V>(fn: (item: T) => V, { a, b }: { a: number; b: string }, [x, y]: [number, number], ...rest: string[]): V[] { return [] }
  [Symbol.iterator](): Iterator<T> { throw new Error() }
}
export type Cond<T> = T extends string ? 'str' : 'other'
export type Ctor<T> = new (value: T) => Base<T>
export type Query = typeof globalThis
export type Dict = { readonly [k: string]: number; (a: string): void; <X>(x: X): X; new (a: number): Base<number> }
export type Quote = 'a"b\\n'
export type Tpl = \`x\${string}y\`
export type Head<T> = T extends [infer H extends string, ...any[]] ? H : never
export type Empty = {}
export type Mapped<T> = { readonly [K in keyof T]?: T[K] }
export function destructured({ a, b }: { a: number; b: string }, [c]: number[], d = 1): void {}
export class Merged { run(a: string): void {} }
export namespace Merged { export function helper(): void {}; export const flag: boolean = true }
export namespace Util {
  export function helper(): void {}
  export namespace Deep {
    export function nested(...args: string[]): void {}
  }
}
`

async function loadSymbols() {
  const specifier = 'file:///mod.ts'
  const result = await doc([specifier], {
    load: async url => ({ kind: 'module', specifier: url, content: SOURCE }),
  })
  return Object.values(result).flatMap(document => document.symbols)
}

describe('docs pipeline with real @deno/doc output', () => {
  it('recognises the shapes the WASM build actually emits', async () => {
    const nodes = flattenSymbols(await loadSymbols())

    const store = nodes.find(node => node.kind === 'class' && node.name === 'Store')
    const level = nodes.find(node => node.kind === 'enum' && node.name === 'Level')
    if (store?.kind !== 'class' || level?.kind !== 'enum') {
      throw new Error('Expected the Store class and Level enum')
    }

    const create = store.def.methods?.find(method => method.name === 'create')
    expect(create && getMethodDef(create)?.returnType?.repr).toBe('Store')
    expect(getEnumMembers(level).map(member => member.name)).toEqual(['Low', 'High'])
    expect(findUnrecognizedShapes(nodes)).toEqual([])
  })

  // Canary Test: when this fails, @deno/doc fixed its types or output. Delete `getMethodDef` and
  // `getEnumMembers` from `processing.ts` and read `def` / `enumDef` directly.
  it('still emits a different shape than the published @deno/doc types', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const store = nodes.find(node => node.kind === 'class' && node.name === 'Store')
    const level = nodes.find(node => node.kind === 'enum' && node.name === 'Level')
    if (store?.kind !== 'class' || level?.kind !== 'enum') {
      throw new Error('Expected the Store class and Level enum')
    }

    const [method] = store.def.methods ?? []
    expect(method).toBeDefined()
    expect(method).toHaveProperty('functionDef')
    expect(method).not.toHaveProperty('def')
    expect(level).toHaveProperty('def')
    expect(level).not.toHaveProperty('enumDef')
  })

  // Canary Test: when this fails to type-check, @deno/doc typed `constructors` properly. Delete
  // `getTypeLiteralConstructors` from `format.ts` and read the signatures directly.
  it('still types type literal constructors as unknown', async () => {
    expectTypeOf<NonNullable<TsTypeLiteralDef['constructors']>[number]>().toBeUnknown()

    const nodes = flattenSymbols(await loadSymbols())
    const dict = nodes.find(node => node.kind === 'typeAlias' && node.name === 'Dict')
    if (dict?.kind !== 'typeAlias' || dict.def.tsType.kind !== 'typeLiteral') {
      throw new Error('Expected the Dict type literal')
    }
    expect(dict.def.tsType.value.constructors).toHaveLength(1)
  })

  it('reports class methods and enums with an Unrecognized shape', async () => {
    const nodes = flattenSymbols(await loadSymbols())

    const store = nodes.find(node => node.kind === 'class' && node.name === 'Store')
    const level = nodes.find(node => node.kind === 'enum' && node.name === 'Level')
    if (store?.kind !== 'class' || level?.kind !== 'enum') {
      throw new Error('Expected the Store class and Level enum')
    }

    const create = store.def.methods?.find(method => method.name === 'create')
    if (!create) throw new Error('Expected Store.create')

    const brokenMethod = { ...create, def: undefined, functionDef: undefined }
    expect(getMethodDef(brokenMethod as unknown as typeof create)).toBeUndefined()
    const brokenEnum = { ...level, def: undefined, enumDef: undefined }
    expect(getEnumMembers(brokenEnum as unknown as typeof level)).toEqual([])

    const brokenStore = { ...store, def: { ...store.def, methods: [brokenMethod] } }
    expect(findUnrecognizedShapes([brokenStore, brokenEnum] as unknown as typeof nodes)).toEqual([
      'class method "Store.create"',
      'enum "Level"',
    ])
  })

  it('flattens symbols, including enums, classes and namespaces', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const names = nodes.map(node => node.name)

    expect(names).toEqual(
      expect.arrayContaining([
        'greet',
        'Pair',
        'Both',
        'Choice',
        'Options',
        'Store',
        'Level',
        'Util.helper',
        'Util.Deep',
        'Util.Deep.nested',
      ]),
    )
    const nested = nodes.find(node => node.name === 'Util.Deep.nested')
    expect(nested && getNodeSignature(nested)).toBe(
      'function Util.Deep.nested(...args: string[]): void',
    )
    expect(nodes.filter(node => node.name === 'greet').length).toBeGreaterThan(1)
  })

  it('formats generic classes, including type arguments passed to the base class', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const box = nodes.find(node => node.name === 'Box')
    expect(box && getNodeSignature(box)).toBe(
      'class Box<T, U extends string = string> extends Base<T> implements Iterable<T>',
    )
  })

  it('formats method params from the real functionDef output', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const box = nodes.find(node => node.kind === 'class' && node.name === 'Box')
    if (box?.kind !== 'class') throw new Error('Expected the Box class')

    const map = box.def.methods?.find(method => method.name === 'map')
    const mapDef = map && getMethodDef(map)
    expect(mapDef && formatParams(mapDef.params)).toBe(
      'fn: (item: T) => V, arg_1: { a: number; b: string }, arg_2: [number, number], ...rest: string[]',
    )
    expect(mapDef && formatType(mapDef.returnType)).toBe('V[]')
  })

  it('formats destructured params and params with default values', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const destructured = nodes.find(node => node.name === 'destructured')
    expect(destructured && getNodeSignature(destructured)).toBe(
      'function destructured(arg_0: { a: number; b: string }, arg_1: number[], d?: number): void',
    )
  })

  it('formats conditional and mapped types', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const cond = nodes.find(node => node.name === 'Cond')
    const mapped = nodes.find(node => node.name === 'Mapped')
    expect(cond && getNodeSignature(cond)).toBe('type Cond<T> = T extends string ? "str" : "other"')
    expect(mapped && getNodeSignature(mapped)).toBe(
      'type Mapped<T> = { readonly [K in keyof T]?: T[K] }',
    )
  })

  it('formats constructor types and type queries', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const ctor = nodes.find(node => node.name === 'Ctor')
    const query = nodes.find(node => node.name === 'Query')
    expect(ctor && getNodeSignature(ctor)).toBe('type Ctor<T> = new (value: T) => Base<T>')
    expect(query && getNodeSignature(query)).toBe('type Query = typeof globalThis')
  })

  it('keeps type literal signatures, escaped strings and template literals', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const signature = (name: string) => {
      const node = nodes.find(n => n.name === name)
      return node && getNodeSignature(node)
    }

    expect(signature('Dict')).toBe(
      'type Dict = { readonly [k: string]: number; (a: string): void; <X>(x: X): X; new (a: number): Base<number> }',
    )
    expect(signature('Quote')).toBe('type Quote = "a\\"b\\n"')
    expect(signature('Tpl')).toBe('type Tpl = `x${string}y`')
    expect(signature('Head')).toBe(
      'type Head<T> = T extends [infer H extends string, ...any[]] ? H : never',
    )
    expect(signature('Empty')).toBe('type Empty = {}')
  })

  it('keeps both declarations when a class and a namespace are merged', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const merged = nodes.filter(node => node.name === 'Merged')
    expect(merged.map(node => node.kind).sort()).toEqual(['class', 'namespace'])
    expect(nodes.map(node => node.name)).toEqual(
      expect.arrayContaining(['Merged.helper', 'Merged.flag']),
    )

    const symbols = mergeOverloads(nodes).filter(symbol => symbol.name.startsWith('Merged'))
    expect(symbols.map(symbol => `${symbol.kind}:${symbol.name}`).sort()).toEqual([
      'class:Merged',
      'function:Merged.helper',
      'namespace:Merged',
      'variable:Merged.flag',
    ])

    const html = await renderDocNodes(mergeOverloads(nodes), buildSymbolLookup(nodes))
    expect(html).toContain('id="class-Merged"')
    expect(html).toContain('id="namespace-Merged"')
    expect(html).toContain('id="function-Merged_helper"')
  })

  it('renders every symbol kind without throwing', async () => {
    const nodes = flattenSymbols(await loadSymbols())
    const html = await renderDocNodes(mergeOverloads(nodes), buildSymbolLookup(nodes))

    expect(html).toContain('id="function-greet"')
    expect(html).toContain('id="enum-Level--Low"')
    expect(html).toContain('id="class-Store--size"')
    expect(html).toContain('id="function-Util_helper"')
    expect(html).toContain('id="function-Util_Deep_nested"')
    expect(html).toContain('id="typeAlias-Pair"')
  })
})
