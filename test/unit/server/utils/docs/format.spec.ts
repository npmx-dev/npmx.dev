import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { formatParams, formatType, getNodeSignature } from '#server/utils/docs/format'
import type { DocNode } from '#server/utils/docs/types'
import type { TsTypeDef } from '@deno/doc'
import { keywordType, param, requireItem, requireNamed } from './helpers'

function loadFixture<K extends DocNode['kind']>(
  name: string,
  kind: K,
): Extract<DocNode, { kind: K }> {
  const path = resolve(__dirname, '../../../../fixtures/esm-sh/doc-nodes', name)
  const node = JSON.parse(readFileSync(path, 'utf-8')) as DocNode
  if (node.kind !== kind) throw new Error(`Expected ${kind} fixture, got ${node.kind}`)
  return node as Extract<DocNode, { kind: K }>
}

// =============================================================================
// Issue #1411: wrong `unknown` types in package api docs
// https://github.com/npmx-dev/npmx.dev/issues/1411
// =============================================================================

describe('issue #1411 - linkdave@0.0.2 unknown types', () => {
  it('event listener: interface properties with fnOrConstructor type (client.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-client.json', 'interface')
    const onProp = requireNamed(node.def.properties, 'on')
    const emitProp = requireNamed(node.def.properties, 'emit')

    const onType = formatType(onProp.tsType)
    expect(onType).not.toBe('unknown')
    expect(onType).toContain('event: K')
    expect(onType).toContain('=> this')

    const emitType = formatType(emitProp.tsType)
    expect(emitType).not.toBe('unknown')
    expect(emitType).toContain('=> boolean')
  })

  it('interface with enum keys: typeLiteral properties (types.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-manager-events.json', 'interface')

    for (const prop of node.def.properties ?? []) {
      const type = formatType(prop.tsType)
      expect(type).not.toBe('unknown')
      expect(type).toContain('node: Node')
    }

    expect(formatType(requireItem(node.def.properties, 2).tsType)).toContain('attempt: number')
  })

  it('type alias with union of object literals (types.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-client-message.json', 'typeAlias')
    const type = formatType(node.def.tsType)

    expect(type).not.toBe('unknown')
    expect(type).toContain('op: ClientOpCodes.Identify; d: IdentifyPayload')
    expect(type).toContain('op: ClientOpCodes.Ping; d?: undefined')
  })

  it('arrow function type alias (client.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-send-to-shard.json', 'typeAlias')
    const type = formatType(node.def.tsType)

    expect(type).not.toBe('unknown')
    expect(type).toContain('guildId: string')
    expect(type).toContain('payload: GatewayVoiceStateUpdate')
    expect(type).toContain('=> void')
  })

  it('Pick<> generic type alias (player.d.ts)', () => {
    const node = loadFixture('linkdave@0.0.2-pick-type.json', 'typeAlias')
    const type = formatType(node.def.tsType)

    expect(type).not.toBe('unknown')
    expect(type).toBe(
      'Pick<GatewayVoiceServerUpdateDispatchData, "token" | "guild_id" | "endpoint">',
    )
  })

  it('getNodeSignature produces valid signatures for issue nodes', () => {
    const sig = getNodeSignature(loadFixture('linkdave@0.0.2-send-to-shard.json', 'typeAlias'))
    expect(sig).not.toContain('unknown')
    expect(sig).toContain('type SendToShardFn =')

    const pickSig = getNodeSignature(loadFixture('linkdave@0.0.2-pick-type.json', 'typeAlias'))
    expect(pickSig).toContain('type RawVoiceServerUpdate =')
    expect(pickSig).not.toContain('= unknown')
  })
})

describe('anonymous function parameters', () => {
  it('uses a positional fallback for a destructured parameter', () => {
    const node = loadFixture('tanstack-highlight@0.0.9-create-highlighter.json', 'function')

    expect(getNodeSignature(node)).toBe(
      'function createHighlighter(arg_0: { fallbackLanguage?: string; languages: ReadonlyArray<LanguageDefinition> }): Highlighter',
    )
  })

  it('uses the zero-based parameter index in fallback names', () => {
    expect(
      formatParams([
        param('value', keywordType('string')),
        { kind: 'object', optional: false, props: [], tsType: keywordType('object') },
      ]),
    ).toBe('value: string, arg_1: object')
  })

  it('prefixes rest parameters with `...`', () => {
    expect(
      formatParams([
        param('first', keywordType('string')),
        {
          kind: 'rest',
          arg: param('args'),
          tsType: { kind: 'array', value: keywordType('string'), repr: '' },
        },
      ]),
    ).toBe('first: string, ...args: string[]')
  })
})

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

function tsType(def: DistributiveOmit<TsTypeDef, 'repr'>): TsTypeDef {
  return { ...def, repr: '' } as TsTypeDef
}

describe('formatType', () => {
  const string = keywordType('string')
  const number = keywordType('number')

  it('formats intersections', () => {
    expect(formatType(tsType({ kind: 'intersection', value: [string, number] }))).toBe(
      'string & number',
    )
  })

  it('formats tuples', () => {
    expect(formatType(tsType({ kind: 'tuple', value: [string, number] }))).toBe('[string, number]')
  })

  it('formats parenthesized types', () => {
    const union = tsType({ kind: 'union', value: [string, number] })
    expect(formatType(tsType({ kind: 'parenthesized', value: union }))).toBe('(string | number)')
    expect(
      formatType(tsType({ kind: 'array', value: tsType({ kind: 'parenthesized', value: union }) })),
    ).toBe('(string | number)[]')
  })

  it('formats rest and optional tuple elements', () => {
    expect(
      formatType(
        tsType({
          kind: 'tuple',
          value: [
            tsType({ kind: 'optional', value: string }),
            tsType({ kind: 'rest', value: tsType({ kind: 'array', value: number }) }),
          ],
        }),
      ),
    ).toBe('[string?, ...number[]]')
  })

  it('formats bigint literals', () => {
    expect(formatType(tsType({ kind: 'literal', value: { kind: 'bigInt', string: '10' } }))).toBe(
      '10n',
    )
  })
})
