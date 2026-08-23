import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatParams, formatType, getNodeSignature } from '#server/utils/docs/format'
import type { DenoDocNode } from '#shared/types/deno-doc'

function loadFixture(name: string): DenoDocNode {
  const path = resolve(__dirname, '../../../../fixtures/esm-sh/doc-nodes', name)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// =============================================================================
// Issue #1411: wrong `unknown` types in package api docs
// https://github.com/npmx-dev/npmx.dev/issues/1411
// =============================================================================

describe('issue #1411 - linkdave@0.0.2 unknown types', () => {
  it('event listener: interface properties with fnOrConstructor type (client.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-client.json')
    const onProp = node.interfaceDef!.properties![0]!
    const emitProp = node.interfaceDef!.properties![1]!

    const onType = formatType(onProp.tsType)
    expect(onType).not.toBe('unknown')
    expect(onType).toContain('event: K')
    expect(onType).toContain('=> this')

    const emitType = formatType(emitProp.tsType)
    expect(emitType).not.toBe('unknown')
    expect(emitType).toContain('=> boolean')
  })

  it('interface with enum keys: typeLiteral properties (types.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-manager-events.json')

    for (const prop of node.interfaceDef!.properties!) {
      const type = formatType(prop.tsType)
      expect(type).not.toBe('unknown')
      expect(type).toContain('node: Node')
    }

    const reconnectProp = node.interfaceDef!.properties![2]!
    expect(formatType(reconnectProp.tsType)).toContain('attempt: number')
  })

  it('type alias with union of object literals (types.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-client-message.json')
    const type = formatType(node.typeAliasDef!.tsType)

    expect(type).not.toBe('unknown')
    expect(type).toContain('op:')
    expect(type).toContain('guildId: string')
  })

  it('arrow function type alias (client.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-send-to-shard.json')
    const type = formatType(node.typeAliasDef!.tsType)

    expect(type).not.toBe('unknown')
    expect(type).toContain('guildId: string')
    expect(type).toContain('payload: GatewayVoiceStateUpdate')
    expect(type).toContain('=> void')
  })

  it('Pick<> generic type alias (player.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-pick-type.json')
    const type = formatType(node.typeAliasDef!.tsType)

    expect(type).not.toBe('unknown')
    expect(type).toBe(
      'Pick<GatewayVoiceServerUpdateDispatchData, "token" | "guild_id" | "endpoint">',
    )
  })

  it('getNodeSignature produces valid signatures for issue nodes', () => {
    const sendToShard = loadFixture('linkdave@0.0.2-send-to-shard.json')
    const sig = getNodeSignature(sendToShard as DenoDocNode)
    expect(sig).not.toContain('unknown')
    expect(sig).toContain('type SendToShardFn =')

    const pickType = loadFixture('linkdave@0.0.2-pick-type.json')
    const pickSig = getNodeSignature(pickType as DenoDocNode)
    expect(pickSig).toContain('type RawVoiceServerUpdate =')
    expect(pickSig).not.toContain('= unknown')
  })
})

describe('anonymous function parameters', () => {
  it('uses a positional fallback for a destructured parameter', () => {
    const node = loadFixture('tanstack-highlight@0.0.9-create-highlighter.json')

    expect(getNodeSignature(node)).toBe(
      'function createHighlighter(arg_0: { fallbackLanguage?: string; languages: ReadonlyArray<LanguageDefinition> }): Highlighter',
    )
  })

  it('uses the zero-based parameter index in fallback names', () => {
    expect(
      formatParams([
        {
          kind: 'identifier',
          name: 'value',
          tsType: { repr: 'string', kind: 'keyword', keyword: 'string' },
        },
        {
          kind: 'object',
          tsType: { repr: 'object', kind: 'keyword', keyword: 'object' },
        },
      ]),
    ).toBe('value: string, arg_1: object')
  })
})

// =============================================================================
// Issue #3154: docs for types give unknown, unknown
// https://github.com/npmx-dev/npmx.dev/issues/3154
//
// deno_doc emits structured tsTypes with an empty `repr` for intersection,
// conditional, mapped, tuple, predicate, etc. Any signature built from those
// kinds degraded to the literal string "unknown".
// =============================================================================

describe('issue #3154 - unhandled tsType kinds render as unknown', () => {
  it('formats intersection types in parameters', () => {
    const type = formatType({
      repr: '',
      kind: 'intersection',
      intersection: [
        { repr: 'string[]', kind: 'keyword', keyword: 'string[]' },
        {
          repr: '',
          kind: 'typeLiteral',
          typeLiteral: {
            properties: [
              { name: 'length', tsType: { repr: 'number', kind: 'keyword', keyword: 'number' } },
            ],
            methods: [],
            callSignatures: [],
            indexSignatures: [],
          },
        },
      ],
    })

    expect(type).not.toBe('unknown')
    expect(type).toBe('string[] & { length: number }')
  })

  it('formats conditional types', () => {
    const type = formatType({
      repr: '',
      kind: 'conditional',
      conditionalType: {
        checkType: { repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } },
        extendsType: { repr: 'object', kind: 'keyword', keyword: 'object' },
        trueType: {
          repr: 'SKey<T>',
          kind: 'typeRef',
          typeRef: {
            typeName: 'SKey',
            typeParams: [{ repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } }],
          },
        },
        falseType: { repr: 'never', kind: 'keyword', keyword: 'never' },
      },
    })

    expect(type).not.toBe('unknown')
    expect(type).toBe('(T extends object ? SKey<T> : never)')
  })

  it('formats mapped types', () => {
    const type = formatType({
      repr: '',
      kind: 'mapped',
      mappedType: {
        readonly: true,
        typeParam: {
          name: 'K',
          constraint: {
            repr: 'keyof T',
            kind: 'typeOperator',
            typeOperator: {
              operator: 'keyof',
              tsType: { repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } },
            },
          },
        },
        tsType: { repr: 'string', kind: 'keyword', keyword: 'string' },
      },
    })

    expect(type).not.toBe('unknown')
    expect(type).toBe('{ readonly [K in keyof T]: string }')
  })

  it('resolves indexed access over mapped/intersection parts without unknowns', () => {
    const type = formatType({
      repr: '',
      kind: 'indexedAccess',
      indexedAccess: {
        objType: {
          repr: '',
          kind: 'mapped',
          mappedType: {
            typeParam: {
              name: 'K',
              constraint: { repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } },
            },
            tsType: {
              repr: '',
              kind: 'tuple',
              tuple: [
                { repr: 'string', kind: 'keyword', keyword: 'string' },
                { repr: 'number', kind: 'keyword', keyword: 'number' },
              ],
            },
          },
        },
        indexType: {
          repr: '',
          kind: 'intersection',
          intersection: [
            {
              repr: 'keyof T',
              kind: 'typeOperator',
              typeOperator: {
                operator: 'keyof',
                tsType: { repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } },
              },
            },
            { repr: 'string', kind: 'keyword', keyword: 'string' },
          ],
        },
      },
    })

    expect(type).not.toBe('unknown')
    expect(type).toBe('{ [K in T]: [string, number] }[keyof T & string]')
  })

  it('formats tuples, typeof queries, import types, infer and predicates', () => {
    expect(
      formatType({
        repr: '',
        kind: 'tuple',
        tuple: [
          { repr: 'string', kind: 'keyword', keyword: 'string' },
          {
            repr: '',
            kind: 'rest',
            rest: { repr: 'number[]', kind: 'keyword', keyword: 'number[]' },
          },
        ],
      }),
    ).toBe('[string, ...number[]]')

    expect(formatType({ repr: 'typeof Button', kind: 'typeQuery', typeQuery: 'Button' })).toBe(
      'typeof Button',
    )

    expect(
      formatType({
        repr: '',
        kind: 'importType',
        importType: {
          specifier: './types.js',
          qualifier: 'Config',
          typeParams: [{ repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } }],
        },
      }),
    ).toBe('import("./types.js").Config<T>')

    expect(
      formatType({
        repr: '',
        kind: 'infer',
        infer: { typeParam: { name: 'U' } },
      }),
    ).toBe('infer U')

    expect(
      formatType({
        repr: '',
        kind: 'typePredicate',
        typePredicate: {
          asserts: false,
          param: { type: 'identifier', name: 'value' },
          type: { repr: 'Parsed', kind: 'typeRef', typeRef: { typeName: 'Parsed' } },
        },
      }),
    ).toBe('value is Parsed')

    expect(
      formatType({
        repr: '',
        kind: 'typePredicate',
        typePredicate: { asserts: true, param: { type: 'this' } },
      }),
    ).toBe('asserts this')

    expect(
      formatType({
        repr: '1n',
        kind: 'literal',
        literal: { kind: 'bigInt', string: '1' },
      }),
    ).toBe('1n')

    expect(
      formatType({
        repr: '',
        kind: 'parenthesized',
        parenthesized: {
          repr: '',
          kind: 'union',
          union: [
            { repr: '"a"', kind: 'literal', literal: { kind: 'string', string: 'a' } },
            { repr: '"b"', kind: 'literal', literal: { kind: 'string', string: 'b' } },
          ],
        },
      }),
    ).toBe('("a" | "b")')
  })

  it('keeps a function signature free of unknown when a parameter is an intersection', () => {
    const node = {
      name: 'translate',
      kind: 'function',
      functionDef: {
        params: [
          {
            kind: 'identifier',
            name: 'schema',
            tsType: { repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } },
          },
          {
            kind: 'identifier',
            name: 'args',
            tsType: {
              repr: '',
              kind: 'intersection',
              intersection: [
                { repr: 'K', kind: 'typeRef', typeRef: { typeName: 'K' } },
                {
                  repr: '',
                  kind: 'indexedAccess',
                  indexedAccess: {
                    objType: { repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } },
                    indexType: {
                      repr: "'length'",
                      kind: 'literal',
                      literal: { kind: 'string', string: 'length' },
                    },
                  },
                },
              ],
            },
          },
        ],
        returnType: {
          repr: 'Translation<T>',
          kind: 'typeRef',
          typeRef: {
            typeName: 'Translation',
            typeParams: [{ repr: 'T', kind: 'typeRef', typeRef: { typeName: 'T' } }],
          },
        },
      },
    } as unknown as DenoDocNode

    expect(getNodeSignature(node)).toBe(
      'function translate(schema: T, args: K & T["length"]): Translation<T>',
    )
  })
})
