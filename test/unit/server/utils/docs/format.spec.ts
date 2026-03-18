import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatType, getNodeSignature } from '../../../../../server/utils/docs/format'
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
