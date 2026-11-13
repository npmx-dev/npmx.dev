import { describe, expect, it } from 'vite-plus/test'
import { convertJsDocLinks, renderEntriesMarkdown } from '#server/utils/docs/markdown'
import { buildSymbolLookup, mergeOverloads } from '#server/utils/docs/processing'
import type { DenoDocNode } from '#shared/types/deno-doc'
import type { ProcessedEntry } from '#server/utils/docs/types'

const voidType = { repr: 'void', kind: 'keyword', keyword: 'void' }
const stringType = { repr: 'string', kind: 'keyword', keyword: 'string' }

function createEntry(nodes: DenoDocNode[], entryPoint = '.', prefix = ''): ProcessedEntry {
  return {
    entryPoint,
    prefix,
    symbols: mergeOverloads(nodes),
    lookup: buildSymbolLookup(nodes, prefix),
  }
}

describe('convertJsDocLinks', () => {
  it('converts external links to Markdown links', () => {
    expect(convertJsDocLinks('See {@link https://example.com}')).toBe(
      'See [https://example.com](https://example.com)',
    )
    expect(convertJsDocLinks('See {@link https://example.com the docs}')).toBe(
      'See [the docs](https://example.com)',
    )
  })

  it('converts symbol references to inline code', () => {
    expect(convertJsDocLinks('Use {@link Foo}')).toBe('Use `Foo`')
    expect(convertJsDocLinks('Use {@link Foo | the foo}')).toBe('Use `the foo`')
  })
})

describe('renderEntriesMarkdown', () => {
  it('renders a function with its description, params and examples', () => {
    const markdown = renderEntriesMarkdown('tinyclip', [
      createEntry([
        {
          name: 'writeText',
          kind: 'function',
          jsDoc: {
            doc: 'Writes text to the clipboard.',
            tags: [
              { kind: 'param', name: 'text', doc: '- The text to write' },
              { kind: 'return', doc: 'A promise that resolves when done' },
              { kind: 'example', doc: '```js\nawait writeText("hi")\n```' },
            ],
          },
          functionDef: {
            isAsync: true,
            params: [{ name: 'text', kind: 'identifier', tsType: stringType }],
            returnType: {
              repr: 'Promise<void>',
              kind: 'typeRef',
              typeRef: { typeName: 'Promise' },
            },
          },
        },
      ]),
    ])

    expect(markdown).toBe(
      [
        '# `tinyclip`',
        '## Functions',
        '### `writeText`',
        '```ts\nasync function writeText(text: string): Promise\n```',
        'Writes text to the clipboard.',
        '**Parameters**\n\n- `text` - The text to write',
        '**Returns**\n\nA promise that resolves when done',
        '**Example**\n\n```js\nawait writeText("hi")\n```',
      ].join('\n\n') + '\n',
    )
  })

  it('renders class and interface members', () => {
    const markdown = renderEntriesMarkdown('pkg', [
      createEntry([
        {
          name: 'Foo',
          kind: 'class',
          classDef: {
            constructors: [{ params: [{ name: 'id', kind: 'identifier', tsType: stringType }] }],
            properties: [
              {
                name: 'id',
                readonly: true,
                tsType: stringType,
                jsDoc: { doc: 'The {@link Foo} id.\nSecond line' },
              },
            ],
            methods: [
              { name: 'run', kind: 'method', functionDef: { params: [], returnType: voidType } },
              {
                name: 'size',
                kind: 'getter',
                functionDef: { params: [], returnType: stringType },
              },
            ],
          },
        },
        {
          name: 'Options',
          kind: 'interface',
          interfaceDef: {
            properties: [{ name: 'debug', optional: true, tsType: stringType }],
            methods: [{ name: 'log', params: [], returnType: voidType }],
          },
        },
      ]),
    ])

    expect(markdown).toContain('## Classes\n\n### `Foo`')
    expect(markdown).toContain('**Constructor**\n\n- `constructor(id: string)`')
    expect(markdown).toContain('**Properties**\n\n- `readonly id: string` - The `Foo` id.')
    expect(markdown).not.toContain('Second line')
    expect(markdown).toContain('**Getters**\n\n- `get size: string`')
    expect(markdown).toContain('**Methods**\n\n- `run(): void`')
    expect(markdown).toContain('## Interfaces\n\n### `Options`')
    expect(markdown).toContain('- `debug?: string`')
    expect(markdown).toContain('- `log(): void`')
  })

  it('renders enum members and deprecation notices', () => {
    const markdown = renderEntriesMarkdown('pkg', [
      createEntry([
        {
          name: 'Color',
          kind: 'enum',
          jsDoc: { tags: [{ kind: 'deprecated', doc: 'Use\n{@link Hue} instead' }] },
          enumDef: { members: [{ name: 'Red' }, { name: 'Blue' }] },
        },
      ]),
    ])

    expect(markdown).toContain('> **Deprecated**: Use `Hue` instead')
    expect(markdown).toContain('**Members**\n\n- `Red`\n- `Blue`')
  })

  it('limits the number of overload signatures', () => {
    const overloads: DenoDocNode[] = Array.from({ length: 7 }, (_, i) => ({
      name: 'h',
      kind: 'function',
      functionDef: {
        params: [{ name: `arg${i}`, kind: 'identifier', tsType: stringType }],
        returnType: voidType,
      },
    }))

    const markdown = renderEntriesMarkdown('pkg', [createEntry(overloads)])

    expect(markdown).toContain('function h(arg4: string): void')
    expect(markdown).not.toContain('arg5')
    expect(markdown).toContain('_+ 2 more overloads_')
  })

  it('uses a longer delimiter when inline code contains backticks', () => {
    const markdown = renderEntriesMarkdown('pkg', [
      createEntry([
        {
          name: 'Options',
          kind: 'interface',
          interfaceDef: {
            properties: [
              {
                name: 'event',
                tsType: { repr: '`on${string}`', kind: 'keyword', keyword: '`on${string}`' },
              },
            ],
          },
        },
      ]),
    ])

    expect(markdown).toContain('- `` event: `on${string}` ``')
  })

  it('groups prefixed entry points under their own headings', () => {
    const fn = (name: string): DenoDocNode => ({
      name,
      kind: 'function',
      functionDef: { params: [], returnType: voidType },
    })

    const markdown = renderEntriesMarkdown('pkg', [
      createEntry([fn('root')]),
      createEntry([fn('sub')], './utils', 'utils'),
    ])

    expect(markdown).toContain('## Functions\n\n### `root`')
    expect(markdown).toContain('## `utils`\n\n### Functions\n\n#### `sub`')
  })
})
