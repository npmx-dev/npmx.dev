import { describe, expect, it } from 'vitest'
import { renderDocNodes, renderGroupedDocNodes, renderGroupedToc } from '#server/utils/docs/render'
import { buildSymbolLookup, mergeOverloads } from '#server/utils/docs/processing'
import { entrySlug } from '#server/utils/docs/text'
import type { DenoDocNode } from '#shared/types/deno-doc'
import type { MergedSymbol, ProcessedEntry } from '#server/utils/docs/types'

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

function createFunctionSymbol(name: string, jsDoc?: DenoDocNode['jsDoc']): MergedSymbol {
  const node: DenoDocNode = {
    name,
    kind: 'function',
    jsDoc,
    functionDef: {
      params: [],
      returnType: { repr: 'void', kind: 'keyword', keyword: 'void' },
    },
  }

  return {
    name,
    kind: 'function',
    jsDoc,
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

describe('renderDocNodes examples', () => {
  it('handles hyphenated fenced code languages in @example tags', async () => {
    const symbol = createFunctionSymbol('renderTemplate', {
      tags: [
        {
          kind: 'example',
          doc: '```glimmer-ts\nconst greeting = <template>Hello</template>\n```',
        },
      ],
    })

    const html = await renderDocNodes([symbol], new Map())

    expect(html).toContain('<h4>Example</h4>')
    expect(html).toContain('shiki')
    expect(html).toContain('greeting')
    expect(html).not.toMatch(/(^|[>\s])-ts([<\s]|$)/)
    expect(html).not.toContain('-ts')
    expect(html).not.toContain('```')
  })
})

// =============================================================================
// Multi-entry packages
// =============================================================================

function createEntry(entryPoint: string, fnNames: string[]): ProcessedEntry {
  const nodes: DenoDocNode[] = fnNames.map(name => ({
    name,
    kind: 'function',
    functionDef: {
      params: [],
      returnType: { repr: 'void', kind: 'keyword', keyword: 'void' },
    },
  }))
  const prefix = entryPoint === '.' ? '' : entrySlug(entryPoint)
  return {
    entryPoint,
    prefix,
    nodes,
    symbols: mergeOverloads(nodes),
    lookup: buildSymbolLookup(nodes, prefix),
  }
}

describe('renderGroupedDocNodes - multi-entry packages', () => {
  it('keeps same-named symbols from different entries separate', async () => {
    const entries = [
      createEntry('./traceparent', ['make', 'parse']),
      createEntry('./tracestate', ['make', 'parse']),
    ]

    const html = await renderGroupedDocNodes(entries)

    // Both entries get their own group with a heading showing the subpath
    // (with the leading `./` pruned).
    expect(html).toContain('id="group-traceparent"')
    expect(html).toContain('id="group-tracestate"')
    expect(html).toContain('>traceparent</h2>')
    expect(html).toContain('>tracestate</h2>')
    expect(html).not.toContain('./traceparent')
    expect(html).not.toContain('./tracestate')

    // Same-named exports must produce distinct, namespaced anchor IDs.
    expect(html).toContain('id="traceparent-function-make"')
    expect(html).toContain('id="tracestate-function-make"')
    expect(html).not.toContain('id="function-make"')

    // Each "make" appears once per entry (not merged into one "2 overloads").
    expect(html).not.toContain('2 overloads')
  })

  it('namespaces section IDs per entry', async () => {
    const entries = [createEntry('./traceparent', ['make']), createEntry('./tracestate', ['make'])]

    const html = await renderGroupedDocNodes(entries)

    expect(html).toContain('id="section-traceparent-function"')
    expect(html).toContain('id="section-tracestate-function"')
  })

  it('renders the root entry flat while grouping subpaths', async () => {
    const entries = [createEntry('.', ['create']), createEntry('./feature', ['make'])]

    const html = await renderGroupedDocNodes(entries)

    // Root content is flat: no group wrapper or heading for `.`.
    expect(html).not.toContain('id="group-"')
    expect(html).not.toContain('>.</h2>')
    // Root symbols keep clean, unprefixed IDs.
    expect(html).toContain('id="function-create"')
    expect(html).not.toContain('id="root-function-create"')
    // Subpaths still render as their own prefixed group.
    expect(html).toContain('id="group-feature"')
    expect(html).toContain('>feature</h2>')
    expect(html).toContain('id="feature-function-make"')
  })

  it('does not collide root and subpath IDs when names match', async () => {
    const entries = [createEntry('.', ['make']), createEntry('./feature', ['make'])]

    const html = await renderGroupedDocNodes(entries)

    expect(html).toContain('id="function-make"')
    expect(html).toContain('id="feature-function-make"')
  })
})

describe('renderGroupedToc - multi-entry packages', () => {
  it('renders one TOC block per entry with matching anchors', () => {
    const entries = [
      createEntry('./traceparent', ['make', 'parse']),
      createEntry('./tracestate', ['make']),
    ]

    const toc = renderGroupedToc(entries)

    expect(toc).toContain('href="#group-traceparent"')
    expect(toc).toContain('href="#group-tracestate"')
    expect(toc).toContain('href="#section-traceparent-function"')
    expect(toc).toContain('href="#traceparent-function-make"')
    expect(toc).toContain('href="#tracestate-function-make"')
    // Entry labels prune the leading `./` and aren't mono.
    expect(toc).toContain('>traceparent</a>')
    expect(toc).not.toContain('./traceparent')
  })

  it('renders the root entry flat with no group label', () => {
    const entries = [createEntry('.', ['create']), createEntry('./feature', ['make'])]

    const toc = renderGroupedToc(entries)

    // Root has no group label and keeps clean anchors.
    expect(toc).not.toContain('href="#group-"')
    expect(toc).toContain('href="#section-function"')
    expect(toc).toContain('href="#function-create"')
    // Subpath keeps its group label + namespaced anchors.
    expect(toc).toContain('href="#group-feature"')
    expect(toc).toContain('href="#feature-function-make"')
  })

  it('exposes a single table-of-contents navigation landmark', () => {
    const entries = [createEntry('./traceparent', ['make']), createEntry('./tracestate', ['make'])]

    const toc = renderGroupedToc(entries)

    // Nested <nav> landmarks with the same label are noisy for assistive tech;
    // the grouped TOC must wrap everything in exactly one landmark.
    expect(toc.match(/<nav\b/g)).toHaveLength(1)
    expect(toc.match(/aria-label="Table of contents"/g)).toHaveLength(1)
  })
})
