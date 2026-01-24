import { describe, expect, it } from 'vitest'
import type { JsDelivrFileNode, PackageFileTree } from '../../shared/types'
import { convertToFileTree } from '../../server/utils/file-tree'

const getChildren = (node?: PackageFileTree): PackageFileTree[] => node?.children ?? []

describe('convertToFileTree', () => {
  it('converts jsDelivr nodes to a sorted tree with directories first', () => {
    const input: JsDelivrFileNode[] = [
      { type: 'file', name: 'zeta.txt', size: 120 },
      {
        type: 'directory',
        name: 'src',
        files: [
          { type: 'file', name: 'b.ts', size: 5 },
          { type: 'file', name: 'a.ts', size: 3 },
        ],
      },
      { type: 'file', name: 'alpha.txt', size: 10 },
      {
        type: 'directory',
        name: 'assets',
        files: [{ type: 'file', name: 'logo.svg', size: 42 }],
      },
    ]

    const tree = convertToFileTree(input)

    const names = tree.map(node => node.name)
    expect(names).toEqual(['assets', 'src', 'alpha.txt', 'zeta.txt'])

    const srcNode = tree.find(node => node.name === 'src')
    expect(srcNode?.type).toBe('directory')
    expect(getChildren(srcNode).map(child => child.name)).toEqual(['a.ts', 'b.ts'])
  })

  it('builds correct paths and preserves file sizes', () => {
    const input: JsDelivrFileNode[] = [
      {
        type: 'directory',
        name: 'src',
        files: [
          { type: 'file', name: 'index.ts', size: 100 },
          {
            type: 'directory',
            name: 'utils',
            files: [{ type: 'file', name: 'format.ts', size: 22 }],
          },
        ],
      },
    ]

    const tree = convertToFileTree(input)

    const src = tree[0]
    expect(src?.path).toBe('src')

    const indexFile = getChildren(src).find(child => child.name === 'index.ts')
    expect(indexFile?.path).toBe('src/index.ts')
    expect(indexFile?.size).toBe(100)

    const utilsDir = getChildren(src).find(child => child.name === 'utils')
    expect(utilsDir?.type).toBe('directory')

    const formatFile = getChildren(utilsDir).find(child => child.name === 'format.ts')
    expect(formatFile?.path).toBe('src/utils/format.ts')
    expect(formatFile?.size).toBe(22)
  })

  it('returns an empty tree for empty input', () => {
    const tree = convertToFileTree([])
    const empty: PackageFileTree[] = []
    expect(tree).toEqual(empty)
  })
})
