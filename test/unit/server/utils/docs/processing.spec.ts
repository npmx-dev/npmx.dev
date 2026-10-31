import { describe, expect, it } from 'vitest'
import { buildSymbolLookup } from '#server/utils/docs/processing'
import type { DenoDocNode } from '#shared/types/deno-doc'

describe('buildSymbolLookup', () => {
  it('maps top-level symbols to their anchor IDs', () => {
    const lookup = buildSymbolLookup([{ name: 'run', kind: 'function' }])

    expect(lookup.get('run')).toBe('function-run')
  })

  it('maps class, interface and enum members with `.` and `#` syntax', () => {
    const nodes: DenoDocNode[] = [
      {
        name: 'CreateTableBuilder',
        kind: 'class',
        classDef: {
          properties: [{ name: 'table' }],
          methods: [{ name: 'addColumn' }],
        },
      },
      {
        name: 'Options',
        kind: 'interface',
        interfaceDef: {
          properties: [{ name: 'level' }],
          methods: [{ name: 'reset' }],
        },
      },
      { name: 'Level', kind: 'enum', enumDef: { members: [{ name: 'High' }] } },
    ]

    const lookup = buildSymbolLookup(nodes)

    expect(lookup.get('CreateTableBuilder.addColumn')).toBe('class-CreateTableBuilder--addColumn')
    expect(lookup.get('CreateTableBuilder#addColumn')).toBe('class-CreateTableBuilder--addColumn')
    expect(lookup.get('CreateTableBuilder.table')).toBe('class-CreateTableBuilder--table')
    expect(lookup.get('Options.level')).toBe('interface-Options--level')
    expect(lookup.get('Options#reset')).toBe('interface-Options--reset')
    expect(lookup.get('Level.High')).toBe('enum-Level--High')
  })

  it('prefixes member IDs for subpath entries', () => {
    const lookup = buildSymbolLookup(
      [{ name: 'Client', kind: 'class', classDef: { methods: [{ name: 'send' }] } }],
      'feature',
    )

    expect(lookup.get('Client.send')).toBe('feature-class-Client--send')
  })

  it('prefers flattened namespace elements over members with the same qualified name', () => {
    const lookup = buildSymbolLookup([
      { name: 'Foo', kind: 'class', classDef: { properties: [{ name: 'bar' }] } },
      { name: 'Foo.bar', kind: 'function' },
    ])

    expect(lookup.get('Foo.bar')).toBe('function-Foo_bar')
  })
})
