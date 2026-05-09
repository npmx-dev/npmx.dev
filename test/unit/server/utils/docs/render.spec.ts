import { describe, expect, it } from 'vitest'
import { renderDocNodes } from '#server/utils/docs/render'
import type { DenoDocNode } from '#shared/types/deno-doc'
import type { MergedSymbol } from '#server/utils/docs/types'

// =============================================================================
// Issue #1943: class getters shown as methods
// https://github.com/npmx-dev/npmx.dev/issues/1943
// =============================================================================

function createClassSymbol(classDef: DenoDocNode['classDef']): MergedSymbol {
  const node: DenoDocNode = {
    name: 'TestClass',
    kind: 'class',
    classDef,
  }
  return {
    name: 'TestClass',
    kind: 'class',
    nodes: [node],
  }
}

function createFunctionSymbol(name: string): MergedSymbol {
  const node: DenoDocNode = {
    name,
    kind: 'function',
    functionDef: {
      params: [],
      returnType: { repr: 'void', kind: 'keyword', keyword: 'void' },
    },
  }

  return {
    name,
    kind: 'function',
    nodes: [node],
  }
}

function createInterfaceSymbol(name: string): MergedSymbol {
  const node: DenoDocNode = {
    name,
    kind: 'interface',
    interfaceDef: {},
  }

  return {
    name,
    kind: 'interface',
    nodes: [node],
  }
}

describe('issue #1943 - class getters separated from methods', () => {
  it('renders getters under a "Getters" heading, not "Methods"', async () => {
    const symbol = createClassSymbol({
      methods: [
        {
          name: 'clientId',
          kind: 'getter',
          functionDef: {
            returnType: { repr: 'string', kind: 'keyword', keyword: 'string' },
          },
        },
      ],
    })

    const html = await renderDocNodes([symbol], new Map())

    expect(html).toContain('<h4>Getters</h4>')
    expect(html).toContain('get clientId')
    expect(html).not.toContain('<h4>Methods</h4>')
  })

  it('renders regular methods under "Methods" heading', async () => {
    const symbol = createClassSymbol({
      methods: [
        {
          name: 'connect',
          kind: 'method',
          functionDef: {
            params: [],
            returnType: { repr: 'void', kind: 'keyword', keyword: 'void' },
          },
        },
      ],
    })

    const html = await renderDocNodes([symbol], new Map())

    expect(html).toContain('<h4>Methods</h4>')
    expect(html).toContain('connect(')
    expect(html).not.toContain('<h4>Getters</h4>')
  })

  it('renders both getters and methods in separate sections', async () => {
    const symbol = createClassSymbol({
      methods: [
        {
          name: 'clientId',
          kind: 'getter',
          functionDef: {
            returnType: { repr: 'string', kind: 'keyword', keyword: 'string' },
          },
          jsDoc: { doc: 'The client ID' },
        },
        {
          name: 'connect',
          kind: 'method',
          functionDef: {
            params: [
              {
                kind: 'identifier',
                name: 'url',
                tsType: { repr: 'string', kind: 'keyword', keyword: 'string' },
              },
            ],
            returnType: { repr: 'void', kind: 'keyword', keyword: 'void' },
          },
          jsDoc: { doc: 'Connect to server' },
        },
      ],
    })

    const html = await renderDocNodes([symbol], new Map())

    // Both sections should exist
    expect(html).toContain('<h4>Getters</h4>')
    expect(html).toContain('<h4>Methods</h4>')

    // Getter should use "get" prefix without parentheses
    expect(html).toContain('get clientId')
    expect(html).toContain('The client ID')

    // Method should have parentheses
    expect(html).toContain('connect(')
    expect(html).toContain('Connect to server')

    // Getters section should appear before Methods section
    const gettersIndex = html.indexOf('<h4>Getters</h4>')
    const methodsIndex = html.indexOf('<h4>Methods</h4>')
    expect(gettersIndex).toBeLessThan(methodsIndex)
  })

  it('renders static getter correctly', async () => {
    const symbol = createClassSymbol({
      methods: [
        {
          name: 'instance',
          kind: 'getter',
          isStatic: true,
          functionDef: {
            returnType: { repr: 'TestClass', kind: 'typeRef', typeRef: { typeName: 'TestClass' } },
          },
        },
      ],
    })

    const html = await renderDocNodes([symbol], new Map())

    expect(html).toContain('static get instance')
  })
})

describe('renderDocNodes ordering', () => {
  it('preserves kind display order while rendering sections in parallel', async () => {
    const html = await renderDocNodes(
      [createInterfaceSymbol('Config'), createFunctionSymbol('run')],
      new Map(),
    )

    const functionsIndex = html.indexOf('id="section-function"')
    const interfacesIndex = html.indexOf('id="section-interface"')

    expect(functionsIndex).toBeGreaterThanOrEqual(0)
    expect(interfacesIndex).toBeGreaterThanOrEqual(0)
    expect(functionsIndex).toBeLessThan(interfacesIndex)
  })

  it('preserves symbol order within a section while rendering symbols in parallel', async () => {
    const html = await renderDocNodes(
      [createFunctionSymbol('alpha'), createFunctionSymbol('beta')],
      new Map(),
    )

    const alphaIndex = html.indexOf('id="function-alpha"')
    const betaIndex = html.indexOf('id="function-beta"')

    expect(alphaIndex).toBeGreaterThanOrEqual(0)
    expect(betaIndex).toBeGreaterThanOrEqual(0)
    expect(alphaIndex).toBeLessThan(betaIndex)
  })
})
