import { describe, expect, it } from 'vite-plus/test'
import { renderDocNodes, renderEntries, renderEntriesToc } from '#server/utils/docs/render'
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
// Issue #3279: {@link} in member descriptions
// https://github.com/npmx-dev/npmx.dev/issues/3279
// =============================================================================

function renderNodes(nodes: DenoDocNode[]): Promise<string> {
  return renderDocNodes(mergeOverloads(nodes), buildSymbolLookup(nodes))
}

function createAddColumnMethod(doc: string) {
  return {
    name: 'addColumn',
    functionDef: { params: [], returnType: { repr: 'void', kind: 'keyword', keyword: 'void' } },
    jsDoc: { doc },
  }
}

describe('issue #3279 - {@link} in member descriptions', () => {
  it('links `Class.member` in class method descriptions to the member anchor', async () => {
    // Mirrors kysely, where `AlterTableBuilder.addColumn` says "See {@link CreateTableBuilder.addColumn}"
    const html = await renderNodes([
      {
        name: 'AlterTableBuilder',
        kind: 'class',
        classDef: { methods: [createAddColumnMethod('See {@link CreateTableBuilder.addColumn}')] },
      },
      {
        name: 'CreateTableBuilder',
        kind: 'class',
        classDef: { methods: [createAddColumnMethod('Adds a column to the table.')] },
      },
    ])

    expect(html).toContain(
      '<dd>See <a href="#class-CreateTableBuilder--addColumn" class="docs-symbol-link">CreateTableBuilder.addColumn</a></dd>',
    )
    expect(html).toContain('<dt id="class-CreateTableBuilder--addColumn">')
    expect(html).not.toContain('{@link')
  })

  it('resolves {@link} in class property and getter descriptions', async () => {
    const html = await renderNodes([
      {
        name: 'Config',
        kind: 'class',
        classDef: {
          properties: [{ name: 'mode', jsDoc: { doc: 'Uses {@link Mode}.' } }],
          methods: [
            {
              name: 'current',
              kind: 'getter',
              functionDef: {},
              jsDoc: { doc: 'Same as {@link Config#mode}.' },
            },
          ],
        },
      },
      { name: 'Mode', kind: 'enum', enumDef: { members: [{ name: 'Fast' }] } },
    ])

    expect(html).toContain('Uses <a href="#enum-Mode" class="docs-symbol-link">Mode</a>.')
    expect(html).toContain(
      'Same as <a href="#class-Config--mode" class="docs-symbol-link">Config#mode</a>.',
    )
  })

  it('resolves {@link} in interface property and method descriptions', async () => {
    const html = await renderNodes([
      {
        name: 'Options',
        kind: 'interface',
        interfaceDef: {
          properties: [{ name: 'level', jsDoc: { doc: 'One of {@link Level.High}.\nMore text.' } }],
          methods: [{ name: 'reset', jsDoc: { doc: 'Resets {@link Options.level}.' } }],
        },
      },
      { name: 'Level', kind: 'enum', enumDef: { members: [{ name: 'High' }] } },
    ])

    expect(html).toContain(
      '<dd>One of <a href="#enum-Level--High" class="docs-symbol-link">Level.High</a>.</dd>',
    )
    expect(html).toContain(
      '<dd>Resets <a href="#interface-Options--level" class="docs-symbol-link">Options.level</a>.</dd>',
    )
    expect(html).toContain('<li id="enum-Level--High">')
    expect(html).not.toContain('More text.')
  })

  it('renders unknown member references as code', async () => {
    const html = await renderNodes([
      {
        name: 'Client',
        kind: 'class',
        classDef: { properties: [{ name: 'url', jsDoc: { doc: 'See {@link Missing.thing}' } }] },
      },
    ])

    expect(html).toContain('<dd>See <code class="docs-symbol-ref">Missing.thing</code></dd>')
  })

  it('still escapes HTML in member descriptions', async () => {
    const html = await renderNodes([
      {
        name: 'Client',
        kind: 'class',
        classDef: { properties: [{ name: 'url', jsDoc: { doc: 'A <script> tag' } }] },
      },
    ])

    expect(html).toContain('<dd>A &lt;script&gt; tag</dd>')
  })

  it('gives overloaded methods a single member anchor', async () => {
    const html = await renderNodes([
      {
        name: 'Store',
        kind: 'class',
        classDef: {
          methods: [
            { name: 'value', kind: 'getter', functionDef: {} },
            { name: 'get', functionDef: { params: [] } },
            { name: 'get', functionDef: { params: [{ kind: 'identifier', name: 'key' }] } },
          ],
        },
      },
    ])

    expect(html.match(/id="class-Store--get"/g)).toHaveLength(1)
    expect(html.match(/id="class-Store--value"/g)).toHaveLength(1)
  })

  it('links {@link Class#constructor} to the first constructor overload', async () => {
    const html = await renderNodes([
      {
        name: 'Client',
        kind: 'class',
        classDef: {
          constructors: [{ params: [] }, { params: [{ kind: 'identifier', name: 'url' }] }],
          properties: [{ name: 'url', jsDoc: { doc: 'Set via {@link Client#constructor}.' } }],
        },
      },
    ])

    expect(html).toContain(
      '<dd>Set via <a href="#class-Client--constructor" class="docs-symbol-link">Client#constructor</a>.</dd>',
    )
    expect(html.match(/id="class-Client--constructor"/g)).toHaveLength(1)
  })

  it('prefixes member links and anchors for subpath entries', async () => {
    const nodes: DenoDocNode[] = [
      {
        name: 'AlterTableBuilder',
        kind: 'class',
        classDef: { methods: [createAddColumnMethod('See {@link CreateTableBuilder.addColumn}')] },
      },
      {
        name: 'CreateTableBuilder',
        kind: 'class',
        classDef: { methods: [createAddColumnMethod('Adds a column to the table.')] },
      },
    ]
    const entries: ProcessedEntry[] = [
      { entryPoint: '.', prefix: '', symbols: [], lookup: new Map() },
      {
        entryPoint: './schema',
        prefix: 'schema',
        symbols: mergeOverloads(nodes),
        lookup: buildSymbolLookup(nodes, 'schema'),
      },
    ]

    const html = await renderEntries(entries)

    expect(html).toContain('href="#schema-class-CreateTableBuilder--addColumn"')
    expect(html).toContain('<dt id="schema-class-CreateTableBuilder--addColumn">')
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
    symbols: mergeOverloads(nodes),
    lookup: buildSymbolLookup(nodes, prefix),
  }
}

describe('renderEntries - multi-entry packages', () => {
  it('keeps same-named symbols from different entries separate', async () => {
    const entries = [
      createEntry('./traceparent', ['make', 'parse']),
      createEntry('./tracestate', ['make', 'parse']),
    ]

    const html = await renderEntries(entries)

    expect(html).toContain('id="group-traceparent"')
    expect(html).toContain('id="group-tracestate"')
    expect(html).toContain('>traceparent</h2>')
    expect(html).toContain('>tracestate</h2>')
    expect(html).not.toContain('./traceparent')
    expect(html).not.toContain('./tracestate')

    expect(html).toContain('id="traceparent-function-make"')
    expect(html).toContain('id="tracestate-function-make"')
    expect(html).not.toContain('id="function-make"')
    expect(html).not.toContain('2 overloads')
  })

  it('namespaces section IDs per entry', async () => {
    const entries = [createEntry('./traceparent', ['make']), createEntry('./tracestate', ['make'])]

    const html = await renderEntries(entries)

    expect(html).toContain('id="section-traceparent-function"')
    expect(html).toContain('id="section-tracestate-function"')
  })

  it('renders the root entry flat while grouping subpaths', async () => {
    const entries = [createEntry('.', ['create']), createEntry('./feature', ['make'])]

    const html = await renderEntries(entries)

    expect(html).not.toContain('id="group-"')
    expect(html).not.toContain('>.</h2>')
    expect(html).toContain('id="function-create"')
    expect(html).not.toContain('id="root-function-create"')
    expect(html).toContain('id="group-feature"')
    expect(html).toContain('>feature</h2>')
    expect(html).toContain('id="feature-function-make"')
  })

  it('does not collide root and subpath IDs when names match', async () => {
    const entries = [createEntry('.', ['make']), createEntry('./feature', ['make'])]

    const html = await renderEntries(entries)

    expect(html).toContain('id="function-make"')
    expect(html).toContain('id="feature-function-make"')
  })
})

describe('renderEntriesToc - multi-entry packages', () => {
  it('renders one TOC block per entry with matching anchors', () => {
    const entries = [
      createEntry('./traceparent', ['make', 'parse']),
      createEntry('./tracestate', ['make']),
    ]

    const toc = renderEntriesToc(entries)

    expect(toc).toContain('href="#group-traceparent"')
    expect(toc).toContain('href="#group-tracestate"')
    expect(toc).toContain('href="#section-traceparent-function"')
    expect(toc).toContain('href="#traceparent-function-make"')
    expect(toc).toContain('href="#tracestate-function-make"')
    expect(toc).toContain('<bdi>./traceparent</bdi>')
    expect(toc).toContain('href="#group-traceparent" class="font-mono')
  })

  it('renders the root entry flat with no group label', () => {
    const entries = [createEntry('.', ['create']), createEntry('./feature', ['make'])]

    const toc = renderEntriesToc(entries)

    expect(toc).not.toContain('href="#group-"')
    expect(toc).toContain('href="#section-function"')
    expect(toc).toContain('href="#function-create"')
    expect(toc).toContain('href="#group-feature"')
    expect(toc).toContain('href="#feature-function-make"')
  })

  it('exposes a single table-of-contents navigation landmark', () => {
    const entries = [createEntry('./traceparent', ['make']), createEntry('./tracestate', ['make'])]

    const toc = renderEntriesToc(entries)

    expect(toc.match(/<nav\b/g)).toHaveLength(1)
    expect(toc.match(/aria-label="Table of contents"/g)).toHaveLength(1)
  })

  it('nests entries under a single top-level list so the flat TOC styles apply', () => {
    const entries = [createEntry('./traceparent', ['make']), createEntry('./tracestate', ['make'])]

    const toc = renderEntriesToc(entries)

    expect(toc.match(/<nav[^>]*>\s*<ul/)).not.toBeNull()
    expect(toc).not.toContain('<div')
    expect(toc).toContain('<li class="docs-toc-group">')
  })
})
