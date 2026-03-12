import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @deno/doc
const docMock = vi.fn()
vi.mock('@deno/doc', () => ({
  doc: (...args: unknown[]) => docMock(...args),
}))

// Mock encodePackageName
vi.mock('#shared/utils/npm', () => ({
  encodePackageName: (name: string) => name.replace('/', '%2f'),
}))

// Mock Nitro globals before importing the module.
// $fetch.raw() is used for esm.sh HEAD requests, $fetch() directly for npm registry GETs.
const $fetchRawMock = vi.fn()
const $fetchMock = Object.assign(vi.fn(), { raw: $fetchRawMock })
vi.stubGlobal('$fetch', $fetchMock)

const { getDocNodes, getDocNodesForEntrypoint, getSubpathExports } =
  await import('../../../../../server/utils/docs/client')

/**
 * Helper to mock esm.sh HEAD responses ($fetch.raw) and npm registry GETs ($fetch).
 *
 * @param headMap - Maps esm.sh URLs to their x-typescript-types header value.
 *   `string` = types URL returned in header, `null` = 200 with no types header,
 *   key absent = 404 (throws).
 * @param registryResponse - Response for npm registry GET calls
 */
function setupMocks(
  headMap: Record<string, string | null>,
  registryResponse?: Record<string, unknown>,
) {
  $fetchRawMock.mockImplementation(async (url: string) => {
    const typesUrl = headMap[url]
    if (typesUrl === undefined) {
      throw new Error(`404 Not Found: ${url}`)
    }
    return {
      headers: new Headers(typesUrl ? { 'x-typescript-types': typesUrl } : {}),
    }
  })

  $fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith('https://registry.npmjs.org/') && registryResponse) {
      return registryResponse
    }
    throw new Error(`Unexpected $fetch call: ${url}`)
  })
}

describe('docs/client - getDocNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('root entry (standard packages)', () => {
    it('returns doc nodes when root entry has types', async () => {
      const typesUrl = 'https://esm.sh/ufo@1.5.0/dist/index.d.ts'
      setupMocks({ 'https://esm.sh/ufo@1.5.0': typesUrl })

      const mockNodes = [{ name: 'parseURL', kind: 'function' }]
      docMock.mockResolvedValue({ [typesUrl]: mockNodes })

      const result = await getDocNodes('ufo', '1.5.0')

      expect(result.nodes).toEqual(mockNodes)
      expect(docMock).toHaveBeenCalledWith(
        [typesUrl],
        expect.objectContaining({ load: expect.any(Function), resolve: expect.any(Function) }),
      )
    })

    it('returns empty nodes when root has no x-typescript-types header', async () => {
      setupMocks({ 'https://esm.sh/pkg@1.0.0': null }, { exports: undefined })

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toEqual([])
      expect(docMock).not.toHaveBeenCalled()
    })

    it('returns empty nodes when esm.sh HEAD request fails', async () => {
      $fetchRawMock.mockRejectedValue(new Error('Network error'))
      $fetchMock.mockRejectedValue(new Error('Network error'))

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toEqual([])
      expect(docMock).not.toHaveBeenCalled()
    })

    it('returns empty nodes when @deno/doc throws', async () => {
      setupMocks({ 'https://esm.sh/pkg@1.0.0': 'https://esm.sh/pkg@1.0.0/index.d.ts' })
      docMock.mockRejectedValue(new Error('WASM error'))

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toEqual([])
    })

    it('collects nodes from multiple specifiers in doc result', async () => {
      const typesUrl = 'https://esm.sh/pkg@1.0.0/index.d.ts'
      setupMocks({ 'https://esm.sh/pkg@1.0.0': typesUrl })

      const reExportedUrl = 'https://esm.sh/pkg@1.0.0/types.d.ts'
      docMock.mockResolvedValue({
        [typesUrl]: [{ name: 'foo', kind: 'function' }],
        [reExportedUrl]: [{ name: 'Bar', kind: 'interface' }],
      })

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toHaveLength(2)
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'foo' }),
          expect.objectContaining({ name: 'Bar' }),
        ]),
      )
    })
  })

  describe('subpath exports fallback', () => {
    it('falls back to subpath exports when root returns 404', async () => {
      const routerTypesUrl = 'https://esm.sh/@thepassle/app-tools@0.10.2/types/router/index.d.ts'
      const apiTypesUrl = 'https://esm.sh/@thepassle/app-tools@0.10.2/types/api/index.d.ts'

      setupMocks(
        {
          'https://esm.sh/@thepassle/app-tools@0.10.2/router.js': routerTypesUrl,
          'https://esm.sh/@thepassle/app-tools@0.10.2/api.js': apiTypesUrl,
        },
        {
          exports: {
            './router.js': { types: './types/router/index.d.ts', default: './router.js' },
            './api.js': { types: './types/api/index.d.ts', default: './api.js' },
          },
        },
      )

      docMock.mockResolvedValue({
        [routerTypesUrl]: [{ name: 'Router', kind: 'class' }],
        [apiTypesUrl]: [{ name: 'createApi', kind: 'function' }],
      })

      const result = await getDocNodes('@thepassle/app-tools', '0.10.2')

      expect(result.nodes).toHaveLength(2)
      expect(docMock).toHaveBeenCalledWith(
        expect.arrayContaining([routerTypesUrl, apiTypesUrl]),
        expect.any(Object),
      )
    })

    it('skips wildcard exports', async () => {
      const stateTypesUrl = 'https://esm.sh/pkg@1.0.0/types/state/index.d.ts'

      setupMocks(
        {
          'https://esm.sh/pkg@1.0.0/state.js': stateTypesUrl,
        },
        {
          exports: {
            './utils/*': { types: './types/utils/*', default: './utils/*' },
            './state.js': { types: './types/state/index.d.ts', default: './state.js' },
          },
        },
      )

      docMock.mockResolvedValue({
        [stateTypesUrl]: [{ name: 'createState', kind: 'function' }],
      })

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toHaveLength(1)
      expect(docMock).toHaveBeenCalledWith([stateTypesUrl], expect.any(Object))
    })

    it('skips root export "." in subpath processing', async () => {
      setupMocks(
        {
          'https://esm.sh/pkg@1.0.0': null,
          'https://esm.sh/pkg@1.0.0/sub.js': 'https://esm.sh/pkg@1.0.0/sub.d.ts',
        },
        {
          exports: {
            '.': { types: './index.d.ts', default: './index.js' },
            './sub.js': { types: './sub.d.ts', default: './sub.js' },
          },
        },
      )

      docMock.mockResolvedValue({
        'https://esm.sh/pkg@1.0.0/sub.d.ts': [{ name: 'sub', kind: 'function' }],
      })

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toHaveLength(1)
      // Root was called once (initial attempt), sub.js was called once (fallback)
      const headUrls = $fetchRawMock.mock.calls.map((call: unknown[]) => call[0])
      expect(headUrls).toEqual(['https://esm.sh/pkg@1.0.0', 'https://esm.sh/pkg@1.0.0/sub.js'])
    })

    it('skips exports without types condition', async () => {
      setupMocks(
        {
          'https://esm.sh/pkg@1.0.0/typed.js': 'https://esm.sh/pkg@1.0.0/typed.d.ts',
        },
        {
          exports: {
            './no-types.js': { default: './no-types.js' },
            './typed.js': { types: './typed.d.ts', default: './typed.js' },
            './package.json': './package.json',
          },
        },
      )

      docMock.mockResolvedValue({
        'https://esm.sh/pkg@1.0.0/typed.d.ts': [{ name: 'typed', kind: 'variable' }],
      })

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]!.name).toBe('typed')
    })

    it('returns empty when no subpath exports have types on esm.sh', async () => {
      setupMocks(
        {
          'https://esm.sh/pkg@1.0.0/sub.js': null,
        },
        {
          exports: {
            './sub.js': { types: './sub.d.ts', default: './sub.js' },
          },
        },
      )

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toEqual([])
      expect(docMock).not.toHaveBeenCalled()
    })

    it('returns empty when package has no exports field', async () => {
      setupMocks({}, { name: 'pkg', version: '1.0.0' })

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toEqual([])
    })

    it('returns empty when npm registry request fails', async () => {
      $fetchRawMock.mockRejectedValue(new Error('Network error'))
      $fetchMock.mockRejectedValue(new Error('Network error'))

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toEqual([])
    })

    it('handles partial subpath failures gracefully', async () => {
      const apiTypesUrl = 'https://esm.sh/pkg@1.0.0/api.d.ts'

      setupMocks(
        {
          // router fails (key absent = throws)
          'https://esm.sh/pkg@1.0.0/api.js': apiTypesUrl,
        },
        {
          exports: {
            './router.js': { types: './router.d.ts', default: './router.js' },
            './api.js': { types: './api.d.ts', default: './api.js' },
          },
        },
      )

      docMock.mockResolvedValue({
        [apiTypesUrl]: [{ name: 'createApi', kind: 'function' }],
      })

      const result = await getDocNodes('pkg', '1.0.0')

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]!.name).toBe('createApi')
    })

    it('encodes scoped package names for npm registry', async () => {
      setupMocks({}, { exports: {} })

      await getDocNodes('@scope/pkg', '1.0.0')

      const registryCall = $fetchMock.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].startsWith('https://registry.npmjs.org/'),
      )
      expect(registryCall).toBeDefined()
      expect(registryCall![0]).toBe('https://registry.npmjs.org/@scope%2fpkg/1.0.0')
    })
  })

  describe('getDocNodesForEntrypoint', () => {
    it('returns doc nodes for a specific entrypoint', async () => {
      const typesUrl = 'https://esm.sh/@thepassle/app-tools@0.10.2/types/router/index.d.ts'
      setupMocks({
        'https://esm.sh/@thepassle/app-tools@0.10.2/router.js': typesUrl,
      })

      const mockNodes = [{ name: 'Router', kind: 'class' }]
      docMock.mockResolvedValue({ [typesUrl]: mockNodes })

      const result = await getDocNodesForEntrypoint('@thepassle/app-tools', '0.10.2', 'router.js')

      expect(result.nodes).toEqual(mockNodes)
      expect(docMock).toHaveBeenCalledWith([typesUrl], expect.any(Object))
    })

    it('returns empty nodes when entrypoint has no types', async () => {
      setupMocks({ 'https://esm.sh/pkg@1.0.0/sub.js': null })

      const result = await getDocNodesForEntrypoint('pkg', '1.0.0', 'sub.js')

      expect(result.nodes).toEqual([])
      expect(docMock).not.toHaveBeenCalled()
    })

    it('returns empty nodes when esm.sh fails for entrypoint', async () => {
      setupMocks({})

      const result = await getDocNodesForEntrypoint('pkg', '1.0.0', 'missing.js')

      expect(result.nodes).toEqual([])
    })

    it('returns empty nodes when @deno/doc throws for entrypoint', async () => {
      setupMocks({
        'https://esm.sh/pkg@1.0.0/sub.js': 'https://esm.sh/pkg@1.0.0/sub.d.ts',
      })
      docMock.mockRejectedValue(new Error('WASM error'))

      const result = await getDocNodesForEntrypoint('pkg', '1.0.0', 'sub.js')

      expect(result.nodes).toEqual([])
    })
  })

  describe('getSubpathExports', () => {
    it('returns subpath exports with types condition', async () => {
      setupMocks(
        {},
        {
          exports: {
            './router.js': { types: './types/router/index.d.ts', default: './router.js' },
            './api.js': { types: './types/api/index.d.ts', default: './api.js' },
          },
        },
      )

      const result = await getSubpathExports('pkg', '1.0.0')

      expect(result).toEqual(['router.js', 'api.js'])
    })

    it('skips root export, wildcards, and non-typed exports', async () => {
      setupMocks(
        {},
        {
          exports: {
            '.': { types: './index.d.ts', default: './index.js' },
            './utils/*': { types: './types/utils/*', default: './utils/*' },
            './no-types.js': { default: './no-types.js' },
            './typed.js': { types: './typed.d.ts', default: './typed.js' },
            './package.json': './package.json',
          },
        },
      )

      const result = await getSubpathExports('pkg', '1.0.0')

      expect(result).toEqual(['typed.js'])
    })

    it('returns empty array when no exports field', async () => {
      setupMocks({}, { name: 'pkg' })

      const result = await getSubpathExports('pkg', '1.0.0')

      expect(result).toEqual([])
    })

    it('returns empty array on registry error', async () => {
      $fetchRawMock.mockRejectedValue(new Error('Network error'))
      $fetchMock.mockRejectedValue(new Error('Network error'))

      const result = await getSubpathExports('pkg', '1.0.0')

      expect(result).toEqual([])
    })
  })
})
