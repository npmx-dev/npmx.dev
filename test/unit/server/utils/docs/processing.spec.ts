import { describe, expect, it } from 'vite-plus/test'
import { buildSymbolLookup } from '#server/utils/docs/processing'
import {
  classConstructor,
  classMethod,
  classNode,
  classProperty,
  enumNode,
  functionNode,
  interfaceMethod,
  interfaceNode,
  interfaceProperty,
} from './helpers'

describe('buildSymbolLookup', () => {
  it('maps top-level symbols to their anchor IDs', () => {
    const lookup = buildSymbolLookup([functionNode('run')])

    expect(lookup.get('run')).toBe('function-run')
  })

  it('maps class, interface and enum members with `.` and `#` syntax', () => {
    const lookup = buildSymbolLookup([
      classNode('CreateTableBuilder', {
        properties: [classProperty('table')],
        methods: [classMethod({ name: 'addColumn' })],
      }),
      interfaceNode('Options', {
        properties: [interfaceProperty('level')],
        methods: [interfaceMethod('reset')],
      }),
      enumNode('Level', ['High']),
    ])

    expect(lookup.get('CreateTableBuilder.addColumn')).toBe('class-CreateTableBuilder--addColumn')
    expect(lookup.get('CreateTableBuilder#addColumn')).toBe('class-CreateTableBuilder--addColumn')
    expect(lookup.get('CreateTableBuilder.table')).toBe('class-CreateTableBuilder--table')
    expect(lookup.get('Options.level')).toBe('interface-Options--level')
    expect(lookup.get('Options#reset')).toBe('interface-Options--reset')
    expect(lookup.get('Level.High')).toBe('enum-Level--High')
  })

  it('prefixes member IDs for subpath entries', () => {
    const lookup = buildSymbolLookup(
      [classNode('Client', { methods: [classMethod({ name: 'send' })] })],
      'feature',
    )

    expect(lookup.get('Client.send')).toBe('feature-class-Client--send')
  })

  it('prefers flattened namespace elements over members with the same qualified name', () => {
    const lookup = buildSymbolLookup([
      classNode('Foo', { properties: [classProperty('bar')] }),
      functionNode('Foo.bar'),
    ])

    expect(lookup.get('Foo.bar')).toBe('function-Foo_bar')
  })

  it('maps class constructors', () => {
    const lookup = buildSymbolLookup([
      classNode('Client', { constructors: [classConstructor()] }),
      classNode('Empty'),
    ])

    expect(lookup.get('Client#constructor')).toBe('class-Client--constructor')
    expect(lookup.get('Client.constructor')).toBe('class-Client--constructor')
    expect(lookup.has('Empty#constructor')).toBe(false)
  })

  it('only maps members of the first declaration of a merged symbol', () => {
    const lookup = buildSymbolLookup([
      interfaceNode('Options', { properties: [interfaceProperty('level')] }),
      interfaceNode('Options', { properties: [interfaceProperty('extra')] }),
      classNode('Options', { properties: [classProperty('own')] }),
    ])

    expect(lookup.get('Options.level')).toBe('interface-Options--level')
    expect(lookup.has('Options.extra')).toBe(false)
    expect(lookup.get('Options.own')).toBe('class-Options--own')
  })
})
