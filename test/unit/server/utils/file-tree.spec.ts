import { describe, expect, it, vi } from 'vitest'
import type { JsDelivrFileNode, PackageFileTree, UnpkgFileMetadata } from '#shared/types'
import {
  convertToFileTree,
  convertUnpkgToFileTree,
  getPackageFileTree,
} from '#server/utils/file-tree'

const getChildren = (node?: PackageFileTree): PackageFileTree[] => node?.children ?? []

const mockFetchOk = <T>(body: T) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const mockFetchError = (status: number) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const mockCreateError = () => {
  const createErrorMock = vi.fn((opts: { statusCode: number; message: string }) => opts)
  vi.stubGlobal('createError', createErrorMock)
  return createErrorMock
}

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
        files: [{ type: 'file', name: 'logo-icon.svg', size: 42 }],
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
    expect(utilsDir?.size).toBe(22)
    expect(src?.size).toBe(122)
  })

  it('returns an empty tree for empty input', () => {
    const tree = convertToFileTree([])
    const empty: PackageFileTree[] = []
    expect(tree).toEqual(empty)
  })

  it('handles directories without a files property', () => {
    const input: JsDelivrFileNode[] = [
      {
        type: 'directory',
        name: 'src',
      },
    ]

    const tree = convertToFileTree(input)

    expect(tree[0]?.type).toBe('directory')
    expect(tree[0]?.size).toBe(0)
    expect(tree[0]?.children).toEqual([])
  })
})

describe('convertUnpkgToFileTree', () => {
  it('rejects metadata whose cumulative path complexity exceeds the tree budget', () => {
    const directoryPrefix = Array.from({ length: 99 }, (_, index) => `d${index}`).join('/')
    const files: UnpkgFileMetadata[] = Array.from({ length: 2501 }, (_, index) => ({
      path: `/${directoryPrefix}/file-${index}.js`,
      size: 1,
      type: 'text/javascript',
      integrity: `sha256-${index}`,
    }))

    expect(() => convertUnpkgToFileTree(files)).toThrow('complexity limit')
  })
})

describe('getPackageFileTree', () => {
  it('throws a 404 error when package is not found', async () => {
    const fetchMock = mockFetchError(404)
    mockCreateError()

    try {
      await expect(getPackageFileTree('pkg', '1.0.0')).rejects.toMatchObject({ statusCode: 404 })
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('throws a 502 error for a primary non-403 failure', async () => {
    const fetchMock = mockFetchError(500)
    mockCreateError()

    try {
      await expect(getPackageFileTree('pkg', '1.0.0')).rejects.toMatchObject({ statusCode: 502 })
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns metadata and a converted tree', async () => {
    const body = {
      type: 'npm',
      name: 'pkg',
      version: '1.0.0',
      default: 'index.js',
      files: [
        {
          type: 'directory',
          name: 'src',
          files: [{ type: 'file', name: 'index.js', size: 5 }],
        },
      ],
    }

    mockFetchOk(body)

    try {
      const result = await getPackageFileTree('pkg', '1.0.0')
      expect(result.package).toBe('pkg')
      expect(result.version).toBe('1.0.0')
      expect(result.default).toBe('index.js')
      expect(result.tree[0]?.path).toBe('src')
      expect(result.tree[0]?.children?.[0]?.path).toBe('src/index.js')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns undefined when default is missing', async () => {
    const body = {
      type: 'npm',
      name: 'pkg',
      version: '1.0.0',
      files: [],
    }

    mockFetchOk(body)

    try {
      const result = await getPackageFileTree('pkg', '1.0.0')
      expect(result.default).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('converts UNPKG metadata after a jsDelivr 403', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, body: { cancel } })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            package: 'pkg',
            version: '1.0.0',
            prefix: '/',
            files: [
              {
                path: '/zeta.txt',
                size: 10,
                type: 'text/plain',
                integrity: 'sha256-zeta',
              },
              {
                path: '/src/nested/index.js',
                size: 25,
                type: 'text/javascript',
                integrity: 'sha256-index',
              },
              {
                path: '/src/main.js',
                size: 15,
                type: 'text/javascript',
                integrity: 'sha256-main',
              },
            ],
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    try {
      const result = await getPackageFileTree('pkg', '1.0.0')

      expect(result.default).toBeUndefined()
      expect(result.tree.map(node => node.name)).toEqual(['src', 'zeta.txt'])
      expect(result.tree[0]?.size).toBe(40)
      expect(result.tree[0]?.children?.map(node => node.name)).toEqual(['nested', 'main.js'])
      expect(result.tree[0]?.children?.[1]).toMatchObject({
        hash: 'main',
        path: 'src/main.js',
      })
      expect(cancel).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('throws a provider-neutral 502 when the fallback fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        body: { cancel: vi.fn().mockResolvedValue(undefined) },
      })
      .mockResolvedValueOnce({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetchMock)
    mockCreateError()

    try {
      await expect(getPackageFileTree('pkg', '1.0.0')).rejects.toMatchObject({
        statusCode: 502,
        message: 'Failed to fetch file list.',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('throws a 502 for invalid fallback metadata', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        body: { cancel: vi.fn().mockResolvedValue(undefined) },
      })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            package: 'pkg',
            version: '1.0.0',
            prefix: '/',
            files: [
              {
                path: '/../index.js',
                size: 1,
                type: 'text/javascript',
                integrity: 'sha256-index',
              },
            ],
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    mockCreateError()

    try {
      await expect(getPackageFileTree('pkg', '1.0.0')).rejects.toMatchObject({
        statusCode: 502,
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('preserves an abort while reading the metadata response body', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(abortError),
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      await expect(getPackageFileTree('pkg', '1.0.0')).rejects.toBe(abortError)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('maps malformed metadata JSON to a provider-neutral 502', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    })
    vi.stubGlobal('fetch', fetchMock)
    mockCreateError()

    try {
      await expect(getPackageFileTree('pkg', '1.0.0')).rejects.toMatchObject({
        statusCode: 502,
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects oversized fallback metadata before parsing it', async () => {
    const fallback = new Response('{}', {
      headers: { 'content-length': `${10 * 1024 * 1024 + 1}` },
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(fallback)
    vi.stubGlobal('fetch', fetchMock)
    mockCreateError()

    try {
      await expect(getPackageFileTree('pkg', '1.0.0')).rejects.toMatchObject({
        statusCode: 502,
      })
      expect(fallback.bodyUsed).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
